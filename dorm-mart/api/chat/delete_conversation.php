<?php
declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';

init_json_endpoint('POST');

$conn = null;
try {
    $userId = require_login();
    $payload = json_request_body_or_error();
    require_csrf_token($payload['csrf_token'] ?? null);

    $convId = request_int($payload, 'conv_id');
    if ($convId <= 0) {
        json_response(['success' => false, 'error' => 'Invalid conversation ID'], 400);
    }

    $conn = db();
    $conn->set_charset('utf8mb4');
    $conn->begin_transaction();

    $stmt = $conn->prepare(
        'SELECT user1_id, user2_id, user1_deleted, user2_deleted
         FROM conversations
         WHERE conv_id = ?
         LIMIT 1
         FOR UPDATE'
    );
    $stmt->bind_param('i', $convId);
    $stmt->execute();
    $conversation = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$conversation) {
        $conn->rollback();
        json_response(['success' => false, 'error' => 'Conversation not found'], 404);
    }

    $isUser1 = $userId === (int)$conversation['user1_id'];
    $isUser2 = $userId === (int)$conversation['user2_id'];
    if (!$isUser1 && !$isUser2) {
        $conn->rollback();
        json_response(['success' => false, 'error' => 'Not authorized to hide this conversation'], 403);
    }

    // Hiding is idempotent: a double-click or retry reports success instead of
    // surfacing a 409 for a state the user already asked for.
    $column = $isUser1 ? 'user1_deleted' : 'user2_deleted';
    $stmt = $conn->prepare("UPDATE conversations SET {$column} = 1 WHERE conv_id = ?");
    $stmt->bind_param('i', $convId);
    $stmt->execute();
    $stmt->close();

    // A hidden conversation must not keep counting toward the chat badge.
    $stmt = $conn->prepare(
        'UPDATE conversation_participants
            SET unread_count = 0, first_unread_msg_id = 0
          WHERE conv_id = ? AND user_id = ?'
    );
    $stmt->bind_param('ii', $convId, $userId);
    $stmt->execute();
    $stmt->close();
    $conn->commit();
    $conn->close();
    json_response([
        'success' => true,
        'hidden' => true,
        'message' => 'Conversation hidden successfully',
    ]);
} catch (Throwable $e) {
    if ($conn instanceof mysqli) {
        try {
            $conn->rollback();
        } catch (Throwable $ignored) {
        }
        $conn->close();
    }
    error_log('delete_conversation error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
