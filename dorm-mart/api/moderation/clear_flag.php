<?php

declare(strict_types=1);

// Remove a message from the profanity-flagged queue after a moderator has
// reviewed it. The message itself is unchanged (readers still see it censored).

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/moderation.php';

init_json_endpoint('POST');
$moderatorId = require_moderator();
$input = json_request_body();
require_csrf_token($input['csrf_token'] ?? null);

$messageId = request_int($input, 'message_id');
if ($messageId <= 0) {
    json_response(['success' => false, 'error' => 'Invalid message'], 400);
}

try {
    $conn = db();
    $conn->set_charset('utf8mb4');

    $stmt = $conn->prepare('SELECT sender_id, is_flagged FROM messages WHERE message_id = ? LIMIT 1');
    $stmt->bind_param('i', $messageId);
    $stmt->execute();
    $message = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$message) {
        json_response(['success' => false, 'error' => 'Message not found'], 404);
    }
    if ((int)$message['is_flagged'] === 0) {
        json_response(['success' => true, 'message_id' => $messageId, 'already_cleared' => true]);
    }

    $stmt = $conn->prepare('UPDATE messages SET is_flagged = 0 WHERE message_id = ?');
    $stmt->bind_param('i', $messageId);
    $stmt->execute();
    $stmt->close();

    moderation_log_action($conn, $moderatorId, 'clear_message_flag', [
        'target_user_id' => $message['sender_id'] !== null ? (int)$message['sender_id'] : null,
        'target_type' => 'message',
        'target_id' => $messageId,
    ]);

    json_response(['success' => true, 'message_id' => $messageId]);
} catch (Throwable $e) {
    error_log('clear flag error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Server error'], 500);
}
