<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/notifications.php';
require_once __DIR__ . '/../helpers/image_upload.php';

init_json_endpoint('POST');

$conn = null;

try {
    $userId = require_login();
    $input = json_request_body();
    require_csrf_token($input['csrf_token'] ?? null);

    $conn = db();
    $conn->set_charset('utf8mb4');

    $accountStmt = $conn->prepare(
        'SELECT hash_pass, is_protected, profile_photo FROM user_accounts WHERE user_id = ? LIMIT 1'
    );
    if (!$accountStmt) throw new RuntimeException('Failed to prepare account lookup');
    $accountStmt->bind_param('i', $userId);
    $accountStmt->execute();
    $account = $accountStmt->get_result()->fetch_assoc();
    $accountStmt->close();

    if (!$account) json_response(['success' => false, 'error' => 'Account not found'], 404);
    if ((int)$account['is_protected'] === 1) {
        json_response(['success' => false, 'error' => 'This account cannot be deleted'], 403);
    }

    $confirmation = is_string($input['confirmation'] ?? null) ? $input['confirmation'] : '';
    $password = is_string($input['currentPassword'] ?? null) ? $input['currentPassword'] : '';
    if ($confirmation !== 'DELETE MY ACCOUNT' || $password === '' || strlen($password) > 64) {
        json_response(['success' => false, 'error' => 'Invalid account deletion confirmation'], 400);
    }
    if (!password_verify($password, (string)$account['hash_pass'])) {
        json_response(['success' => false, 'error' => 'Current password is incorrect'], 401);
    }

    $ownedImages = [];
    if (!empty($account['profile_photo'])) $ownedImages[] = (string)$account['profile_photo'];

    $conn->begin_transaction();

    $listingStmt = $conn->prepare(
        'SELECT product_id, title, photos FROM INVENTORY WHERE seller_id = ? FOR UPDATE'
    );
    if (!$listingStmt) throw new RuntimeException('Failed to prepare listing lookup');
    $listingStmt->bind_param('i', $userId);
    $listingStmt->execute();
    $listingResult = $listingStmt->get_result();
    $listings = [];
    while ($listing = $listingResult->fetch_assoc()) $listings[] = $listing;
    $listingStmt->close();

    foreach ($listings as $listing) {
        $productId = (int)$listing['product_id'];
        $title = (string)$listing['title'];
        $photos = json_decode((string)($listing['photos'] ?? ''), true);
        if (is_array($photos)) {
            foreach ($photos as $photo) if (is_string($photo)) $ownedImages[] = $photo;
        }

        notification_for_wishlist($conn, $productId, [
            'type' => 'item_deleted',
            'product_id' => null,
            'title' => $title,
            'message' => $title . ' was removed because the seller deleted their account.',
            'image_url' => notification_first_image($listing['photos'] ?? null),
            'severity' => 'warning',
            'destination' => null,
            'idempotency_key' => 'account-deleted-' . $productId,
        ], $userId);

        $conversationStmt = $conn->prepare(
            'SELECT conv_id, user1_id, user2_id, user1_fname, user2_fname
             FROM conversations WHERE product_id = ?'
        );
        if (!$conversationStmt) throw new RuntimeException('Failed to prepare conversation lookup');
        $conversationStmt->bind_param('i', $productId);
        $conversationStmt->execute();
        $conversationResult = $conversationStmt->get_result();

        while ($conversation = $conversationResult->fetch_assoc()) {
            $convId = (int)$conversation['conv_id'];
            $deletedIsUser1 = (int)$conversation['user1_id'] === $userId;
            $receiverId = (int)($deletedIsUser1 ? $conversation['user2_id'] : $conversation['user1_id']);
            $receiverName = (string)($deletedIsUser1 ? $conversation['user2_fname'] : $conversation['user1_fname']);
            $senderName = 'Deleted User';
            $message = "This user's account has been deleted. This chat has been closed.";
            $metadata = json_encode(['type' => 'account_deleted'], JSON_UNESCAPED_SLASHES);

            $messageStmt = $conn->prepare(
                'INSERT INTO messages
                 (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            if (!$messageStmt) throw new RuntimeException('Failed to prepare account deletion message');
            $messageStmt->bind_param(
                'iiissss',
                $convId,
                $userId,
                $receiverId,
                $senderName,
                $receiverName,
                $message,
                $metadata
            );
            $messageStmt->execute();
            $messageStmt->close();

            $closeStmt = $conn->prepare('UPDATE conversations SET item_deleted = TRUE WHERE conv_id = ?');
            if (!$closeStmt) throw new RuntimeException('Failed to prepare conversation close');
            $closeStmt->bind_param('i', $convId);
            $closeStmt->execute();
            $closeStmt->close();
        }
        $conversationStmt->close();

        account_delete_run($conn, 'DELETE FROM wishlist WHERE product_id = ?', 'i', $productId);
        account_delete_run($conn, 'DELETE FROM wishlist_notification WHERE product_id = ?', 'i', $productId);
        account_delete_run($conn, 'DELETE FROM INVENTORY WHERE product_id = ? AND seller_id = ?', 'ii', $productId, $userId);
    }

    account_delete_run($conn, 'DELETE FROM wishlist WHERE user_id = ?', 'i', $userId);
    account_delete_run($conn, 'DELETE FROM wishlist_notification WHERE seller_id = ?', 'i', $userId);
    account_delete_run($conn, 'UPDATE INVENTORY SET sold_to = NULL WHERE sold_to = ?', 'i', $userId);

    $accountDeletedMessage = "This user's account has been deleted. This chat has been closed.";
    $accountDeletedMetadata = json_encode(['type' => 'account_deleted'], JSON_UNESCAPED_SLASHES);
    account_delete_run(
        $conn,
        "INSERT INTO messages
         (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata)
         SELECT c.conv_id,
                ?,
                CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END,
                'Deleted User',
                CASE WHEN c.user1_id = ? THEN c.user2_fname ELSE c.user1_fname END,
                ?,
                ?
         FROM conversations c
         WHERE (c.user1_id = ? OR c.user2_id = ?)
           AND NOT EXISTS (
             SELECT 1 FROM messages m WHERE m.conv_id = c.conv_id AND m.metadata = ?
           )",
        'iiissiis',
        $userId,
        $userId,
        $userId,
        $accountDeletedMessage,
        $accountDeletedMetadata,
        $userId,
        $userId,
        $accountDeletedMetadata
    );
    account_delete_run(
        $conn,
        'UPDATE conversations SET item_deleted = TRUE WHERE user1_id = ? OR user2_id = ?',
        'ii',
        $userId,
        $userId
    );

    account_delete_run(
        $conn,
        "UPDATE messages SET sender_id = NULL, sender_fname = 'Deleted User' WHERE sender_id = ?",
        'i',
        $userId
    );
    account_delete_run(
        $conn,
        "UPDATE messages SET receiver_id = NULL, receiver_fname = 'Deleted User' WHERE receiver_id = ?",
        'i',
        $userId
    );
    account_delete_run(
        $conn,
        "UPDATE conversations
         SET user1_id = NULL, user1_fname = 'Deleted User', user1_deleted = TRUE
         WHERE user1_id = ?",
        'i',
        $userId
    );
    account_delete_run(
        $conn,
        "UPDATE conversations
         SET user2_id = NULL, user2_fname = 'Deleted User', user2_deleted = TRUE
         WHERE user2_id = ?",
        'i',
        $userId
    );

    account_delete_run(
        $conn,
        "UPDATE purchased_items SET seller_user_id = NULL, sold_by = 'Deleted User' WHERE seller_user_id = ?",
        'i',
        $userId
    );
    account_delete_run($conn, 'UPDATE purchased_items SET buyer_user_id = NULL WHERE buyer_user_id = ?', 'i', $userId);

    account_delete_run(
        $conn,
        "UPDATE scheduled_purchase_requests
         SET status = 'cancelled', canceled_by_user_id = NULL
         WHERE (seller_user_id = ? OR buyer_user_id = ?) AND status IN ('pending', 'accepted')",
        'ii',
        $userId,
        $userId
    );
    account_delete_run(
        $conn,
        "UPDATE confirm_purchase_requests
         SET status = 'seller_cancelled'
         WHERE (seller_user_id = ? OR buyer_user_id = ?) AND status = 'pending'",
        'ii',
        $userId,
        $userId
    );
    account_delete_run(
        $conn,
        'DELETE n FROM notifications n
         INNER JOIN scheduled_purchase_requests spr ON spr.request_id = n.scheduled_request_id
         WHERE (spr.seller_user_id = ? OR spr.buyer_user_id = ?) AND n.available_at > NOW()',
        'ii',
        $userId,
        $userId
    );
    account_delete_run(
        $conn,
        'UPDATE scheduled_purchase_requests SET seller_user_id = NULL WHERE seller_user_id = ?',
        'i',
        $userId
    );
    account_delete_run(
        $conn,
        'UPDATE scheduled_purchase_requests SET buyer_user_id = NULL WHERE buyer_user_id = ?',
        'i',
        $userId
    );
    account_delete_run(
        $conn,
        'UPDATE scheduled_purchase_requests SET canceled_by_user_id = NULL WHERE canceled_by_user_id = ?',
        'i',
        $userId
    );
    account_delete_run(
        $conn,
        'UPDATE confirm_purchase_requests SET seller_user_id = NULL WHERE seller_user_id = ?',
        'i',
        $userId
    );
    account_delete_run(
        $conn,
        'UPDATE confirm_purchase_requests SET buyer_user_id = NULL WHERE buyer_user_id = ?',
        'i',
        $userId
    );

    account_delete_run($conn, 'DELETE FROM conversation_participants WHERE user_id = ?', 'i', $userId);
    account_delete_run($conn, 'DELETE FROM typing_status WHERE user_id = ?', 'i', $userId);
    account_delete_run($conn, 'DELETE FROM notifications WHERE recipient_user_id = ?', 'i', $userId);
    account_delete_run($conn, 'DELETE FROM purchase_history WHERE user_id = ?', 'i', $userId);
    account_delete_run($conn, 'DELETE FROM product_reviews WHERE buyer_user_id = ? OR seller_user_id = ?', 'ii', $userId, $userId);
    account_delete_run($conn, 'DELETE FROM buyer_ratings WHERE buyer_user_id = ? OR seller_user_id = ?', 'ii', $userId, $userId);
    account_delete_run(
        $conn,
        'DELETE lrl FROM login_rate_limits lrl
         INNER JOIN login_history lh ON lh.session_hash = SHA2(lrl.session_id, 256)
         WHERE lh.user_id = ?',
        'i',
        $userId
    );
    account_delete_run($conn, 'DELETE FROM login_history WHERE user_id = ?', 'i', $userId);

    $deletedRows = account_delete_run($conn, 'DELETE FROM user_accounts WHERE user_id = ?', 'i', $userId);
    if ($deletedRows !== 1) throw new RuntimeException('Account deletion did not remove one account');

    $conn->commit();
    $conn->close();
    $conn = null;

    account_delete_owned_images($ownedImages, $userId);

    session_regenerate_id(true);
    if (isset($_COOKIE['auth_token'])) {
        setcookie('auth_token', '', [
            'expires' => time() - 3600,
            'path' => '/',
            'httponly' => true,
            'secure' => auth_is_https_request(),
            'samesite' => 'Lax',
        ]);
    }
    logout_destroy_session();

    json_response(['success' => true]);
} catch (Throwable $e) {
    if ($conn instanceof mysqli) {
        try { $conn->rollback(); } catch (Throwable $_) {}
        $conn->close();
    }
    error_log('delete_account error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Unable to delete account'], 500);
}

function account_delete_run(mysqli $conn, string $sql, string $types = '', mixed ...$params): int
{
    $stmt = $conn->prepare($sql);
    if (!$stmt) throw new RuntimeException('Failed to prepare account deletion statement');
    if ($types !== '') $stmt->bind_param($types, ...$params);
    if (!$stmt->execute()) throw new RuntimeException('Failed to execute account deletion statement');
    $affectedRows = $stmt->affected_rows;
    $stmt->close();
    return $affectedRows;
}

function account_delete_owned_images(array $paths, int $userId): void
{
    $imagesDir = data_images_dir();
    foreach (glob($imagesDir . DIRECTORY_SEPARATOR . 'profile_' . $userId . '_*') ?: [] as $path) {
        $paths[] = '/images/' . basename($path);
    }

    foreach (array_unique($paths) as $value) {
        $path = parse_url((string)$value, PHP_URL_PATH);
        if (!is_string($path) || !str_starts_with($path, '/images/')) continue;
        $filename = basename(rawurldecode($path));
        $isOwnedUpload = str_starts_with($filename, 'profile_' . $userId . '_')
            || str_starts_with($filename, 'img_u' . $userId . '_');
        if (!$isOwnedUpload) continue;

        $file = $imagesDir . DIRECTORY_SEPARATOR . $filename;
        if (is_file($file) && !@unlink($file)) error_log('Failed to delete account image: ' . $filename);
    }
}
