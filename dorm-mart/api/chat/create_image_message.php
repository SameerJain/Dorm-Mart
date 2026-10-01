<?php

declare(strict_types=1);
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../helpers/image_upload.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../helpers/profanity.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/../helpers/moderation.php';
require_once __DIR__ . '/../database/db_connect.php';

init_json_endpoint();

$conn = db();
$conn->set_charset('utf8mb4');

auth_boot_session();

// --- auth: require a logged-in user ---
$userId = require_login();
$sender = $userId;

// A body over post_max_size reaches PHP with $_POST and $_FILES both empty, so
// the CSRF check below would fail with a misleading error (and the client
// would retry the whole upload). Report the real cause first.
if (empty($_POST) && empty($_FILES) && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    json_response(['success' => false, 'error' => 'file_too_large'], 413);
}

// This endpoint expects multipart/form-data with an image or video attachment.
require_multipart_formdata();

/* Read form fields (sent via FormData on the client) */
$receiverId = request_int($_POST, 'receiver_id');
$contentRaw = is_string($_POST['content'] ?? null) ? trim($_POST['content']) : '';
$convIdParam = array_key_exists('conv_id', $_POST) && $_POST['conv_id'] !== ''
    ? strict_integer_value($_POST['conv_id'])
    : null;

require_csrf_token($_POST['csrf_token'] ?? null);

/* Validate presence of receiver and the uploaded attachment.
   Caption (contentRaw) is allowed to be empty for media-only messages. */
if ($receiverId <= 0 || (array_key_exists('conv_id', $_POST) && $_POST['conv_id'] !== '' && $convIdParam === null)) {
    json_response(['success' => false, 'error' => 'missing_receiver'], 400);
}
$uploadError = $_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE;
if (in_array($uploadError, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
    json_response(['success' => false, 'error' => 'file_too_large'], 413);
}
if (!isset($_FILES['image']) || $uploadError !== UPLOAD_ERR_OK) {
    json_response(['success' => false, 'error' => 'missing_image'], 400);
}

$senderId = (int)$sender;
if ($senderId === $receiverId) {
    json_response(['success' => false, 'error' => 'Cannot message yourself'], 400);
}

// Uploads can be up to 25 MB each, so they get their own, tighter flood cap
// than text messages; without one a script could fill the upload volume.
$mediaLimit = consume_rate_limit(
    scoped_rate_limit_key('chat_media', $senderId),
    CHAT_MEDIA_MAX_PER_WINDOW,
    CHAT_MESSAGE_WINDOW_MINUTES,
    CHAT_MESSAGE_LOCKOUT_MINUTES
);
if ($mediaLimit['blocked']) {
    $retryAfterSeconds = max(1, (int)$mediaLimit['retry_after_seconds']);
    if (!headers_sent()) {
        header('Retry-After: ' . $retryAfterSeconds);
    }
    json_response([
        'success' => false,
        'error' => 'You are sending photos and videos too quickly. Please wait a moment and try again.',
    ], 429);
}

if (!chat_user_exists($conn, $receiverId)) {
    json_response(['success' => false, 'error' => 'Receiver not found'], 404);
}
if (moderation_user_is_banned($conn, $receiverId)) {
    json_response(['success' => false, 'error' => 'This user is no longer available'], 403);
}

$content = $contentRaw;

/* Caption length guard (same policy as text messages) */
$len = function_exists('mb_strlen') ? mb_strlen($content, 'UTF-8') : strlen($content);
if ($len > 500) {
    json_response([
        'success' => false,
        'error'   => 'content_too_long',
        'max'     => 500,
        'length'  => $len
    ], 400);
}

/* --- Validate and store the uploaded media --- */
$MAX_BYTES = 25 * 1024 * 1024;
$allowed = [
    'image/jpeg'      => 'jpg',
    'image/png'       => 'png',
    'image/webp'      => 'webp',
    'video/mp4'       => 'mp4',
    'video/webm'      => 'webm',
    'video/quicktime' => 'mov',
];
$imageInfo = uploaded_image_info($_FILES['image'], $MAX_BYTES, $allowed);
if (!$imageInfo['ok']) {
    $payload = ['success' => false, 'error' => $imageInfo['error']];
    if (isset($imageInfo['max_bytes'])) {
        $payload['max_bytes'] = $imageInfo['max_bytes'];
    }
    json_response($payload, $imageInfo['status']);
}
$isVideo = strpos((string)$imageInfo['mime'], 'video/') === 0;
if (!$isVideo && (int)$imageInfo['size'] > 2 * 1024 * 1024) {
    json_response([
        'success' => false,
        'error' => 'image_too_large',
        'max_bytes' => 2 * 1024 * 1024,
    ], 400);
}
$ext = $imageInfo['extension'];

/* Build destination dir under the configured uploads root. */
$destDir = data_media_dir('chat-attachments');
if (!is_dir($destDir)) {
    if (!ensure_upload_directory($destDir)) {
        json_response(['success' => false, 'error' => 'media_dir_unwritable'], 500);
    }
}

/* Generate a unique filename to avoid collisions */
$fname = sprintf(
    'u%s_%s_%s.%s',
    $senderId,
    gmdate('Ymd_His'),
    bin2hex(random_bytes(6)),  // random suffix
    $ext
);
$destPath = $destDir . '/' . $fname;

/* Move the uploaded temp file to the destination */
if (!@move_uploaded_file($imageInfo['tmp_name'], $destPath)) {
    json_response(['success' => false, 'error' => 'media_save_failed'], 500);
}

/* Build the public relative URL path that your frontend can render.
   Assumes /media is web-accessible from the project root. */
$imageRelUrl = '/media/chat-attachments/' . $fname;

/* --- Conversation plumbing (same as create_message.php) --- */
$u1 = min($senderId, $receiverId);
$u2 = max($senderId, $receiverId);
$lockKey = "conv:$u1:$u2";

$convId = null;
$msgId  = null;
/* will hold ISO-8601 UTC string, e.g., 2025-10-31T03:05:06Z */
$createdIso = null;
$filteredContent = $content;
$committed = false;

try {
    $conn->begin_transaction();

    // Acquire advisory lock
    $stmt = $conn->prepare('SELECT GET_LOCK(?, 5) AS got_lock');
    $stmt->bind_param('s', $lockKey);
    $stmt->execute();
    $res = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$res || (int)$res['got_lock'] !== 1) {
        throw new RuntimeException('Busy. Try again.');
    }

    $names = chat_user_display_names($conn, $senderId, $receiverId);
    $senderName = $names[$senderId];
    $receiverName = $names[$receiverId];
    $convId = chat_resolve_direct_conversation(
        $conn,
        $u1,
        $u2,
        $names[$u1],
        $names[$u2],
        $convIdParam
    );
    if ($convId === null) {
        chat_release_lock($conn, $lockKey);
        @unlink($destPath);
        $conn->rollback();
        json_response(['success' => false, 'error' => 'Invalid conversation ID'], 403);
    }

    // If item is deleted, block media message creation
    if (chat_conversation_is_closed($conn, $convId)) {
        chat_release_lock($conn, $lockKey);
        $conn->rollback();
        @unlink($destPath);
        json_response(['success' => false, 'error' => 'Item has been deleted. Cannot send messages.'], 403);
    }

    chat_ensure_participants($conn, $convId, $u1, $u2);
    chat_reopen_conversation($conn, $convId);

    /* Insert media message (stored in the legacy messages.image_url column). */
    $isFlagged = contains_profanity($conn, $content) ? 1 : 0;
    $stmt = $conn->prepare(
        'INSERT INTO messages
           (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, is_flagged, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->bind_param('iiisssis', $convId, $senderId, $receiverId, $senderName, $receiverName, $content, $isFlagged, $imageRelUrl);
    $stmt->execute();
    $msgId = (int)$conn->insert_id;
    $stmt->close();

    // Fetch created_at in ISO-8601 UTC
    $stmt = $conn->prepare(
        'SELECT DATE_FORMAT(created_at, "%Y-%m-%dT%H:%i:%sZ") AS created_at
           FROM messages
          WHERE message_id = ?'
    );
    $stmt->bind_param('i', $msgId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $createdIso = $row ? (string)$row['created_at'] : null;

    chat_increment_unread($conn, $msgId, $convId, $receiverId);

    $filteredContent = filter_profanity($conn, $content);

    // Commit before releasing so the next lock holder sees this transaction's rows.
    $conn->commit();
    $committed = true;
    chat_release_lock($conn, $lockKey);

    if ($createdIso === null) {
        $createdIso = gmdate('Y-m-d\TH:i:s\Z');
    }

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    echo json_encode([
        'success'     => true,
        'conv_id'     => $convId,
        'message_id'  => $msgId,
        'message'     => [
            'message_id' => $msgId,
            'content'    => $filteredContent,
            'is_flagged' => (bool)$isFlagged,
            'created_at' => $createdIso,    // ISO-8601 UTC
            'image_url'  => $imageRelUrl,   // relative public path
        ],
    ], JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    try { $conn->rollback(); } catch (Throwable $_) {}
    if (!$committed && isset($destPath) && is_file($destPath)) @unlink($destPath);
    if (!empty($lockKey)) chat_release_lock($conn, $lockKey);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error']);
}
