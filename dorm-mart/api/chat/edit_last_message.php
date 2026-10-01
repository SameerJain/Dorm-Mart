<?php
declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../helpers/profanity.php';
require_once __DIR__ . '/helpers.php';

init_json_endpoint('POST');

try {
    $userId = require_login();
    $input = json_request_body();
    require_csrf_token($input['csrf_token'] ?? null);
    $messageId = request_int($input, 'message_id');
    $content = is_string($input['content'] ?? null) ? trim($input['content']) : '';
    $length = function_exists('mb_strlen') ? mb_strlen($content, 'UTF-8') : strlen($content);

    if ($messageId <= 0 || $content === '') json_response(['success' => false, 'error' => 'Message cannot be empty'], 400);
    if ($length > 500) json_response(['success' => false, 'error' => 'Message cannot exceed 500 characters'], 400);

    $conn = db();
    $conn->set_charset('utf8mb4');
    $stmt = $conn->prepare(
        'SELECT message_id, conv_id, content, image_url, metadata
         FROM messages WHERE message_id = ? AND sender_id = ? AND deleted_at IS NULL LIMIT 1'
    );
    if (!$stmt) throw new RuntimeException('Failed to prepare message lookup');
    $stmt->bind_param('ii', $messageId, $userId);
    $stmt->execute();
    $message = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$message) json_response(['success' => false, 'error' => 'Message not found'], 404);
    if (!empty($message['image_url']) || !empty($message['metadata'])) json_response(['success' => false, 'error' => 'This message cannot be edited'], 409);

    $convId = (int)$message['conv_id'];
    $latestStmt = $conn->prepare(
        'SELECT message_id FROM messages
         WHERE conv_id = ? AND sender_id = ? AND image_url IS NULL AND metadata IS NULL AND deleted_at IS NULL
         ORDER BY message_id DESC LIMIT 1'
    );
    if (!$latestStmt) throw new RuntimeException('Failed to prepare latest message lookup');
    $latestStmt->bind_param('ii', $convId, $userId);
    $latestStmt->execute();
    $latest = $latestStmt->get_result()->fetch_assoc();
    $latestStmt->close();
    if (!$latest || (int)$latest['message_id'] !== $messageId) json_response(['success' => false, 'error' => 'Only your last sent message can be edited'], 409);

    if (chat_conversation_is_closed($conn, $convId)) {
        json_response(['success' => false, 'error' => 'This chat has been closed.'], 409);
    }

    // A reported message stays as the moderator will see it until the report
    // is handled; editing it away would erase the evidence.
    $reportStmt = $conn->prepare("SELECT 1 FROM message_reports WHERE message_id = ? AND status = 'open' LIMIT 1");
    if (!$reportStmt) throw new RuntimeException('Failed to prepare report lookup');
    $reportStmt->bind_param('i', $messageId);
    $reportStmt->execute();
    $hasOpenReport = $reportStmt->get_result()->num_rows > 0;
    $reportStmt->close();
    if ($hasOpenReport) {
        json_response(['success' => false, 'error' => "This message was reported and can't be edited until a moderator reviews it."], 409);
    }

    // original_content keeps the pre-edit text for moderators (set once, on the first edit).
    // A flag set before the edit is kept: rewording a flagged message must not clear it.
    $isFlagged = contains_profanity($conn, $content) ? 1 : 0;
    $update = $conn->prepare(
        'UPDATE messages
            SET original_content = COALESCE(original_content, content),
                content = ?,
                is_flagged = GREATEST(is_flagged, ?),
                edited_at = NOW()
          WHERE message_id = ? AND sender_id = ? AND deleted_at IS NULL'
    );
    if (!$update) throw new RuntimeException('Failed to prepare message update');
    $update->bind_param('siii', $content, $isFlagged, $messageId, $userId);
    $update->execute();
    $updated = $update->affected_rows;
    $update->close();
    if ($updated !== 1) {
        // Zero rows means either the message was deleted after the lookup, or
        // an identical save landed in the same second. Only the first is an error.
        $check = $conn->prepare('SELECT 1 FROM messages WHERE message_id = ? AND deleted_at IS NULL LIMIT 1');
        $check->bind_param('i', $messageId);
        $check->execute();
        $stillThere = $check->get_result()->num_rows > 0;
        $check->close();
        if (!$stillThere) {
            json_response(['success' => false, 'error' => 'Message not found'], 404);
        }
    }

    $timeStmt = $conn->prepare('SELECT DATE_FORMAT(edited_at, "%Y-%m-%dT%H:%i:%sZ") AS edited_at FROM messages WHERE message_id = ?');
    $timeStmt->bind_param('i', $messageId);
    $timeStmt->execute();
    $editedAt = $timeStmt->get_result()->fetch_assoc()['edited_at'] ?? gmdate('Y-m-d\TH:i:s\Z');
    $timeStmt->close();

    json_response(['success' => true, 'message' => [
        'message_id' => $messageId,
        'content' => filter_profanity($conn, $content),
        'is_flagged' => (bool)$isFlagged,
        'edited_at' => $editedAt,
    ]]);
} catch (Throwable $e) {
    error_log('edit_last_message error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
