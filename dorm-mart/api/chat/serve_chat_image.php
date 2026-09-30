<?php
declare(strict_types=1);

header('X-Content-Type-Options: nosniff'); // helps prevent MIME sniffing

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../helpers/image_upload.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/file_stream.php';
require_once __DIR__ . '/../database/db_connect.php';

set_security_headers();    // your existing security headers
set_secure_cors();         // your existing CORS (same-site is fine for images)

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  json_response(['success' => false, 'error' => 'Method Not Allowed'], 405);
}

auth_boot_session();
$userId = require_login();                 // must be logged in
// Streaming a large video must not hold the session lock, or every other
// request from this user (including chat polls) waits for it to finish.
session_write_close();

// --- inputs ---
$messageId = request_int($_GET, 'message_id');
$forceDownload = isset($_GET['download']) && $_GET['download'] === '1';

if ($messageId <= 0) {
  json_response(['success' => false, 'error' => 'bad_message_id'], 400);
}

// Verify the requester is a participant in the conversation that owns this message
// and fetch the stored attachment URL.
$sql = '
  SELECT m.image_url, m.conv_id, c.user1_id, c.user2_id
    FROM messages m
    JOIN conversations c ON c.conv_id = m.conv_id
   WHERE m.message_id = ? AND m.deleted_at IS NULL
   LIMIT 1
';
$conn = db();
$stmt = $conn->prepare($sql);
$stmt->bind_param('i', $messageId);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();
// Release the connection before streaming: a large video can take minutes.
$conn->close();

if (!$row) {
  json_response(['success' => false, 'error' => 'not_found'], 404);
}

// Must be either user1 or user2 of that conversation
if ((int)$row['user1_id'] !== (int)$userId && (int)$row['user2_id'] !== (int)$userId) {
  json_response(['success' => false, 'error' => 'forbidden'], 403);
}

$imageRel = (string)($row['image_url'] ?? '');
if ($imageRel === '') {
  json_response(['success' => false, 'error' => 'no_image'], 404);
}
if (strpos($imageRel, '/media/chat-images/') !== 0
    && strpos($imageRel, '/media/chat-attachments/') !== 0) {
  json_response(['success' => false, 'error' => 'file_missing'], 404);
}

// Build absolute path safely from the configured chat media directory.
$mediaSubdir = strpos($imageRel, '/media/chat-attachments/') === 0
    ? 'chat-attachments'
    : 'chat-images';
$mediaRoot = real_upload_path(data_media_dir($mediaSubdir));
$file = basename($imageRel);
$absPath = $mediaRoot !== null ? realpath($mediaRoot . DIRECTORY_SEPARATOR . $file) : false;
$mediaPrefix = $mediaRoot !== null ? rtrim($mediaRoot, '/\\') . DIRECTORY_SEPARATOR : null;

// Security: ensure the resolved path is still under the media directory we expect
if (!$absPath || !$mediaPrefix || !str_starts_with($absPath, $mediaPrefix) || !is_file($absPath)) {
  json_response(['success' => false, 'error' => 'file_missing'], 404);
}

// Detect MIME type from file bytes (prevents spoofing)
$finfo = new finfo(FILEINFO_MIME_TYPE);              // requires php-fileinfo extension
$mime  = $finfo->file($absPath) ?: 'application/octet-stream';

$allowedMimes = [
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
];
if (!in_array($mime, $allowedMimes, true)) {
  json_response(['success' => false, 'error' => 'unsupported_mime'], 415);
}

// Set headers for inline view or download. The stored filename embeds the
// uploader's id, so both views use a neutral name.
$extension = strtolower((string)pathinfo($absPath, PATHINFO_EXTENSION));
$mediaType = strpos($mime, 'video/') === 0 ? 'video' : 'image';
$downloadName = sprintf('dorm-mart-chat-%s-%d.%s', $mediaType, $messageId, $extension);
header('Cache-Control: private, max-age=604800');    // cache 7 days for the same user/session
header('Content-Disposition: ' . ($forceDownload ? 'attachment' : 'inline') . '; filename="' . $downloadName . '"');

// Stream the file (with Range support for video seeking); no JSON afterward.
stream_file_with_ranges($absPath, $mime);
