<?php
declare(strict_types=1);

if (php_sapi_name() !== 'cli') { http_response_code(403); exit("Forbidden\n"); }

require_once __DIR__ . '/../api/database/db_connect.php';
require_once __DIR__ . '/../api/helpers/promo_email.php';
require_once __DIR__ . '/../api/helpers/image_upload.php';
require_once __DIR__ . '/../api/helpers/inventory.php';

$conn = db();
$dryRun = in_array('--dry-run', $argv ?? [], true);
$users = $conn->query(
    "SELECT user_id, first_name, last_name, email, promo_frequency, promo_last_sent_at,
            interested_category_1, interested_category_2, interested_category_3
     FROM user_accounts
     WHERE promotional = 1 AND promo_frequency IN ('daily','weekly')
       AND (promo_last_sent_at IS NULL
         OR (promo_frequency = 'daily' AND promo_last_sent_at <= NOW() - INTERVAL 1 DAY)
         OR (promo_frequency = 'weekly' AND promo_last_sent_at <= NOW() - INTERVAL 7 DAY))"
);

$sent = 0; $skipped = 0; $failed = 0;
while ($user = $users->fetch_assoc()) {
    $interests = array_values(array_filter([
        $user['interested_category_1'], $user['interested_category_2'], $user['interested_category_3'],
    ]));
    if (!$interests) { $skipped++; continue; }

    $conditions = implode(' OR ', array_fill(0, count($interests), 'JSON_CONTAINS(categories, JSON_QUOTE(?))'));
    $sql = "SELECT product_id, title, listing_price, photos FROM INVENTORY
            WHERE item_status = 'Active' AND seller_id != ? AND ({$conditions})
            ORDER BY date_listed DESC, product_id DESC LIMIT 6";
    $stmt = $conn->prepare($sql);
    $types = 'i' . str_repeat('s', count($interests));
    $params = array_merge([(int)$user['user_id']], $interests);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $result = $stmt->get_result();
    $items = [];
    while ($item = $result->fetch_assoc()) {
        $photo = inventory_first_photo($item['photos'] ?? null);
        $path = $photo ? data_images_dir() . DIRECTORY_SEPARATOR . basename((string)$photo) : null;
        $cid = $path && is_file($path) ? 'promo-item-' . (int)$item['product_id'] : null;
        $items[] = [
            'title' => (string)$item['title'], 'price' => (float)$item['listing_price'],
            'url' => dm_frontend_url('app/viewProduct/' . (int)$item['product_id']),
            'image_cid' => $cid,
            'inline_image' => $cid ? ['path' => $path, 'cid' => $cid, 'name' => basename($path)] : null,
        ];
    }
    $stmt->close();
    if (!$items) { $skipped++; continue; }

    if ($dryRun) { $sent++; continue; }

    $package = dm_promotional_items_package((string)$user['first_name'], $items);
    $outcome = send_promo_welcome_email([
        'firstName' => $user['first_name'], 'lastName' => $user['last_name'], 'email' => $user['email'],
    ], $package);
    if (!$outcome['ok']) { $failed++; error_log('Promotional digest failed for user ' . $user['user_id']); continue; }

    $update = $conn->prepare('UPDATE user_accounts SET promo_last_sent_at = NOW() WHERE user_id = ?');
    $update->bind_param('i', $user['user_id']);
    $update->execute();
    $update->close();
    $sent++;
}

echo json_encode(['dry_run' => $dryRun, 'sent' => $sent, 'skipped' => $skipped, 'failed' => $failed]) . PHP_EOL;
