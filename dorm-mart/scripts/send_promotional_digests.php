<?php
declare(strict_types=1);

if (php_sapi_name() !== 'cli') { http_response_code(403); exit("Forbidden\n"); }

require_once __DIR__ . '/../api/database/db_connect.php';
require_once __DIR__ . '/../api/helpers/promo_email.php';
require_once __DIR__ . '/../api/helpers/inventory.php';
require_once __DIR__ . '/../api/helpers/promo_schedule.php';

$dryRun = in_array('--dry-run', $argv ?? [], true);
$schedule = dm_promo_schedule(new DateTimeImmutable('now'));
if (!$dryRun && !$schedule['send_window']) {
    echo json_encode(['skipped' => true, 'reason' => 'Outside the 5 p.m. America/New_York send window']) . PHP_EOL;
    exit(0);
}

$conn = db();
// A database lock also prevents overlapping workers on different hosts.
if (!$dryRun && (int)$conn->query("SELECT GET_LOCK('dm_promotional_digests', 0)")->fetch_row()[0] !== 1) {
    echo json_encode(['skipped' => true, 'reason' => 'Another digest job is running']) . PHP_EOL;
    $conn->close();
    exit(0);
}
$dueUsers = $conn->prepare(
    "SELECT user_id, first_name, last_name, email, promo_frequency, promo_last_sent_at,
            interested_category_1, interested_category_2, interested_category_3
     FROM user_accounts
     WHERE promotional = 1 AND promo_frequency IN ('daily','weekly')
       AND (promo_last_sent_at IS NULL
         OR (promo_frequency = 'daily' AND promo_last_sent_at < ?)
         OR (promo_frequency = 'weekly' AND promo_last_sent_at < ?))"
);
$dueUsers->bind_param('ss', $schedule['daily_before'], $schedule['weekly_before']);
$dueUsers->execute();
$users = $dueUsers->get_result();

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
        $imageUrl = $photo ? dm_api_url('media/image.php') . '?url=' . rawurlencode('/images/' . basename((string)$photo)) : null;
        $items[] = [
            'title' => (string)$item['title'], 'price' => (float)$item['listing_price'],
            'url' => dm_frontend_url('app/viewProduct/' . (int)$item['product_id']),
            'image_url' => str_starts_with((string)$imageUrl, 'http') ? $imageUrl : null,
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

$dueUsers->close();
$conn->close(); // Releases the advisory lock.
echo json_encode(['dry_run' => $dryRun, 'send_window' => $schedule['send_window'], 'sent' => $dryRun ? 0 : $sent, 'would_send' => $dryRun ? $sent : 0, 'skipped' => $skipped, 'failed' => $failed]) . PHP_EOL;
exit($failed > 0 ? 1 : 0);
