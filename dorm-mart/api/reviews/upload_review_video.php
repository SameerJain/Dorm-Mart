<?php
declare(strict_types=1);
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../helpers/image_upload.php';
require_once __DIR__ . '/../database/db_connect.php';

init_json_endpoint('POST');
auth_boot_session();
$userId = require_login();
require_csrf_token($_POST['csrf_token'] ?? null);
require_multipart_formdata();
require_upload_quota($userId, 'review_video');
$file = $_FILES['video'] ?? null;
if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    json_response(['success' => false, 'error' => 'Please upload a video up to 25 MB'], 400);
}
$info = uploaded_image_info($file, 25 * 1024 * 1024, [
    'video/mp4' => 'mp4', 'video/webm' => 'webm', 'video/quicktime' => 'mov',
]);
if (!$info['ok']) {
    json_response(['success' => false, 'error' => 'Use an MP4, WebM, or MOV video up to 25 MB'], 400);
}
$dir = data_media_dir('review-images');
if (!ensure_upload_directory($dir)) {
    json_response(['success' => false, 'error' => 'Unable to save video'], 500);
}
$name = sprintf('review_u%d_%s_%s.%s', $userId, gmdate('Ymd_His'), bin2hex(random_bytes(6)), $info['extension']);
if (!move_uploaded_file($info['tmp_name'], $dir . '/' . $name)) {
    json_response(['success' => false, 'error' => 'Unable to save video'], 500);
}
json_response(['success' => true, 'video_url' => '/media/review-images/' . $name]);
