<?php

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../helpers/profanity.php';
require_once __DIR__ . '/../helpers/request.php';
require __DIR__ . '/../database/db_connect.php';

init_json_endpoint();

auth_boot_session();
$userId = require_login();

$conn = db();
$conn->query("SET time_zone = '+00:00'");

$convId = request_int($_GET, 'conv_id');
$tsSec  = array_key_exists('ts', $_GET) ? strict_integer_value($_GET['ts']) : 0;

if ($convId <= 0 || $tsSec === null || $tsSec < 0) {
    json_response(['success' => false, 'error' => 'Invalid conversation query'], 400);
}

// AUTHORIZATION: verify the authenticated user is a participant in this conversation
if ($convId > 0) {
    $authStmt = $conn->prepare('SELECT conv_id FROM conversations WHERE conv_id = ? AND (user1_id = ? OR user2_id = ?) LIMIT 1');
    $authStmt->bind_param('iii', $convId, $userId, $userId);
    $authStmt->execute();
    if ($authStmt->get_result()->num_rows === 0) {
        json_response(['success' => false, 'error' => 'Unauthorized'], 403);
    }
    $authStmt->close();
}

$stmt = $conn->prepare(
  'SELECT
       message_id, conv_id, sender_id, receiver_id,
       CASE WHEN deleted_at IS NULL THEN content ELSE \'This message was deleted\' END AS content,
       CASE WHEN deleted_at IS NULL THEN is_flagged ELSE 0 END AS is_flagged,
       CASE WHEN deleted_at IS NULL THEN image_url ELSE NULL END AS image_url,
       CASE WHEN deleted_at IS NULL THEN metadata ELSE NULL END AS metadata,
       DATE_FORMAT(created_at, "%Y-%m-%dT%H:%i:%sZ") AS created_at,
       DATE_FORMAT(edited_at,  "%Y-%m-%dT%H:%i:%sZ") AS edited_at,
       DATE_FORMAT(deleted_at, "%Y-%m-%dT%H:%i:%sZ") AS deleted_at,
       DATE_FORMAT(GREATEST(created_at, COALESCE(edited_at, created_at), COALESCE(deleted_at, created_at)), "%Y-%m-%dT%H:%i:%sZ") AS activity_at
     FROM messages
    WHERE conv_id = ?
      AND (created_at >= FROM_UNIXTIME(?) OR edited_at >= FROM_UNIXTIME(?) OR deleted_at >= FROM_UNIXTIME(?))
    ORDER BY message_id ASC'
);
$stmt->bind_param('iiii', $convId, $tsSec, $tsSec, $tsSec);
$stmt->execute();

$res = $stmt->get_result(); // requires mysqlnd; otherwise switch to bind_result loop
$messages = [];
while ($row = $res->fetch_assoc()) {
    // Enrich schedule_request messages with current scheduled purchase status
    $metadata = json_decode($row['metadata'] ?? '{}', true);
    if (isset($metadata['type']) && $metadata['type'] === 'schedule_request' && isset($metadata['request_id'])) {
        $requestId = (int)$metadata['request_id'];
        // Fetch current status and buyer_response_at from scheduled_purchase_requests
        $statusStmt = $conn->prepare('SELECT status, buyer_response_at FROM scheduled_purchase_requests WHERE request_id = ? LIMIT 1');
        if ($statusStmt) {
            $statusStmt->bind_param('i', $requestId);
            $statusStmt->execute();
            $statusRes = $statusStmt->get_result();
            if ($statusRes && $statusRes->num_rows > 0) {
                $statusRow = $statusRes->fetch_assoc();
                // Add status and buyer_response_at to metadata
                $metadata['scheduled_purchase_status'] = (string)$statusRow['status'];
                if (!empty($statusRow['buyer_response_at'])) {
                    $dt = date_create($statusRow['buyer_response_at'], new DateTimeZone('UTC'));
                    if ($dt) {
                        $metadata['buyer_response_at'] = $dt->format(DateTime::ATOM);
                    }
                }
                $row['metadata'] = json_encode($metadata, JSON_UNESCAPED_SLASHES);
            }
            $statusStmt->close();
        }
    }
    // Enrich confirm_request messages with current confirm purchase status
    if (isset($metadata['type']) && $metadata['type'] === 'confirm_request' && isset($metadata['confirm_request_id'])) {
        $confirmRequestId = (int)$metadata['confirm_request_id'];
        // Fetch current status and buyer_response_at from confirm_purchase_requests
        $confirmStatusStmt = $conn->prepare('SELECT status, buyer_response_at FROM confirm_purchase_requests WHERE confirm_request_id = ? LIMIT 1');
        if ($confirmStatusStmt) {
            $confirmStatusStmt->bind_param('i', $confirmRequestId);
            $confirmStatusStmt->execute();
            $confirmStatusRes = $confirmStatusStmt->get_result();
            if ($confirmStatusRes && $confirmStatusRes->num_rows > 0) {
                $confirmStatusRow = $confirmStatusRes->fetch_assoc();
                // Add status and buyer_response_at to metadata
                $metadata['confirm_purchase_status'] = (string)$confirmStatusRow['status'];
                if (!empty($confirmStatusRow['buyer_response_at'])) {
                    $dt = date_create($confirmStatusRow['buyer_response_at'], new DateTimeZone('UTC'));
                    if ($dt) {
                        $metadata['buyer_response_at'] = $dt->format(DateTime::ATOM);
                    }
                }
                $row['metadata'] = json_encode($metadata, JSON_UNESCAPED_SLASHES);
            }
            $confirmStatusStmt->close();
        }
    }
    $row['content'] = filter_profanity($conn, (string)$row['content']);
    $row['is_flagged'] = (bool)$row['is_flagged'];
    $row['is_deleted'] = $row['deleted_at'] !== null;
    $messages[] = $row;
}
$stmt->close();

// --- mark as read for the caller (sets "no unread") ---
$stmt = $conn->prepare(
    'UPDATE conversation_participants
        SET unread_count = 0,
            first_unread_msg_id = 0
      WHERE conv_id = ? AND user_id = ?'
);
$stmt->bind_param('ii', $convId, $userId);
$stmt->execute();
$stmt->close();

// Get typing status for other user in conversation
$typingStatus = [
    'is_typing' => false,
    'typing_user_first_name' => null
];
$conversationStatus = null;

if ($convId > 0) {
    // Verify user has access to this conversation and get other user's ID
    $convStmt = $conn->prepare(
        'SELECT c.user1_id, c.user2_id, c.item_deleted, inv.item_status AS product_status
           FROM conversations c
           LEFT JOIN INVENTORY inv ON inv.product_id = c.product_id
          WHERE c.conv_id = ?
          LIMIT 1'
    );
    $convStmt->bind_param('i', $convId);
    $convStmt->execute();
    $convRes = $convStmt->get_result();
    if ($convRes && $convRes->num_rows > 0) {
        $convRow = $convRes->fetch_assoc();
        $conversationStatus = [
            'product_status' => $convRow['product_status'] ?? null,
            'item_deleted' => (bool)($convRow['item_deleted'] ?? false),
        ];
        $otherUserId = ((int)$convRow['user1_id'] === $userId) ? (int)$convRow['user2_id'] : (int)$convRow['user1_id'];
        
        if ($otherUserId > 0) {
            // Get typing status for other user with their name, only if updated within last 8 seconds
            // The 8 second window accounts for network latency and polling intervals
            // Note: 30-second continuous typing timeout is handled on the frontend
            $typingStmt = $conn->prepare('SELECT ts.is_typing, ua.first_name 
                                        FROM typing_status ts
                                        INNER JOIN user_accounts ua ON ts.user_id = ua.user_id
                                        WHERE ts.conversation_id = ? AND ts.user_id = ? 
                                        AND ts.updated_at > DATE_SUB(NOW(), INTERVAL 8 SECOND)');
            $typingStmt->bind_param('ii', $convId, $otherUserId);
            $typingStmt->execute();
            $typingRes = $typingStmt->get_result();
            
            if ($typingRes && $typingRes->num_rows > 0) {
                $typingRow = $typingRes->fetch_assoc();
                $typingStatus['is_typing'] = (bool)(int)$typingRow['is_typing'];
                if ($typingStatus['is_typing'] && !empty($typingRow['first_name'])) {
                    $typingStatus['typing_user_first_name'] = $typingRow['first_name'];
                }
            }
            $typingStmt->close();
        }
    }
    $convStmt->close();
}

json_response([
    'success'  => true,
    'conv_id'  => $convId,
    'messages' => $messages, // array of only-new messages
    'typing_status' => $typingStatus, // typing status for other user
    'conversation_status' => $conversationStatus,
    // Keep a one-second overlap so messages/edits sharing a timestamp are not missed.
    'cursor_ts' => max(0, time() - 1),
], 200, JSON_UNESCAPED_SLASHES);
