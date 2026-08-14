<?php
declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';

init_json_endpoint('POST');

ensure_session();
if (empty($_SESSION['user_id'])) {
    json_response(['success' => false, 'error' => 'Please log in again'], 401);
}

$userId = require_login();
$input = json_request_body();
require_csrf_token($input['csrf_token'] ?? null);
$messageId = isset($input['message_id']) ? (int)$input['message_id'] : 0;

if ($messageId <= 0) {
    json_response(['success' => false, 'error' => "message ID doesn't exist"], 404);
}

$conn = null;

try {
    $conn = db();
    $conn->set_charset('utf8mb4');
    $conn->begin_transaction();

    $messageStmt = $conn->prepare(
        'SELECT message_id, conv_id, receiver_id, deleted_at
           FROM messages
          WHERE message_id = ? AND sender_id = ?
          LIMIT 1
          FOR UPDATE'
    );
    if (!$messageStmt) {
        throw new RuntimeException('Failed to prepare message lookup');
    }
    $messageStmt->bind_param('ii', $messageId, $userId);
    $messageStmt->execute();
    $message = $messageStmt->get_result()->fetch_assoc();
    $messageStmt->close();

    if (!$message) {
        $conn->rollback();
        json_response(['success' => false, 'error' => "message ID doesn't exist"], 404);
    }
    if ($message['deleted_at'] !== null) {
        $conn->rollback();
        json_response(['success' => false, 'error' => 'Message already deleted'], 409);
    }

    $convId = (int)$message['conv_id'];
    $receiverId = (int)$message['receiver_id'];
    $latestStmt = $conn->prepare(
        'SELECT message_id
           FROM messages
          WHERE conv_id = ? AND sender_id = ? AND deleted_at IS NULL
          ORDER BY message_id DESC
          LIMIT 1
          FOR UPDATE'
    );
    if (!$latestStmt) {
        throw new RuntimeException('Failed to prepare latest message lookup');
    }
    $latestStmt->bind_param('ii', $convId, $userId);
    $latestStmt->execute();
    $latest = $latestStmt->get_result()->fetch_assoc();
    $latestStmt->close();

    if (!$latest || (int)$latest['message_id'] !== $messageId) {
        $conn->rollback();
        json_response(['success' => false, 'error' => 'Only your last sent message can be deleted'], 409);
    }

    $deleteStmt = $conn->prepare(
        'UPDATE messages
            SET deleted_at = UTC_TIMESTAMP()
          WHERE message_id = ? AND sender_id = ? AND deleted_at IS NULL'
    );
    if (!$deleteStmt) {
        throw new RuntimeException('Failed to prepare message deletion');
    }
    $deleteStmt->bind_param('ii', $messageId, $userId);
    $deleteStmt->execute();
    if ($deleteStmt->affected_rows !== 1) {
        $deleteStmt->close();
        throw new RuntimeException('Message deletion did not update one row');
    }
    $deleteStmt->close();

    // A deleted unread message should no longer contribute to the recipient's badge.
    $unreadStmt = $conn->prepare(
        'UPDATE conversation_participants
            SET first_unread_msg_id = CASE WHEN unread_count = 1 THEN 0 ELSE first_unread_msg_id END,
                unread_count = unread_count - 1
          WHERE conv_id = ?
            AND user_id = ?
            AND unread_count > 0
            AND first_unread_msg_id > 0
            AND first_unread_msg_id <= ?'
    );
    if (!$unreadStmt) {
        throw new RuntimeException('Failed to prepare unread count update');
    }
    $unreadStmt->bind_param('iii', $convId, $receiverId, $messageId);
    $unreadStmt->execute();
    $unreadStmt->close();

    $timeStmt = $conn->prepare(
        'SELECT DATE_FORMAT(deleted_at, "%Y-%m-%dT%H:%i:%sZ") AS deleted_at
           FROM messages
          WHERE message_id = ?'
    );
    if (!$timeStmt) {
        throw new RuntimeException('Failed to prepare deletion time lookup');
    }
    $timeStmt->bind_param('i', $messageId);
    $timeStmt->execute();
    $deletedAt = $timeStmt->get_result()->fetch_assoc()['deleted_at'] ?? gmdate('Y-m-d\TH:i:s\Z');
    $timeStmt->close();

    $conn->commit();

    json_response([
        'success' => true,
        'message' => 'success',
        'message_id' => $messageId,
        'deleted_at' => $deletedAt,
    ]);
} catch (Throwable $e) {
    if ($conn instanceof mysqli) {
        try {
            $conn->rollback();
        } catch (Throwable $_) {
        }
    }
    error_log('delete_message error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
