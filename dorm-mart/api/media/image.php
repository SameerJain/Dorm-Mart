<?php
declare(strict_types=1);

// Serves public product, profile, and review media. Chat media requires participant auth.

// Include security utilities
require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../helpers/image_upload.php';
require_once __DIR__ . '/../helpers/file_stream.php';
set_security_headers();
set_secure_cors();

/** @return never */
function media_fail(int $status, string $message): void
{
    http_response_code($status);
    exit($message);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    media_fail(405, 'Method Not Allowed');
}

// Must match upload_profile_photo.php / product_listing.php: uploads honor DATA_UPLOADS_DIR.
$imageDir = real_upload_path(data_images_dir());
if ($imageDir === null) {
    media_fail(500, 'Image directory not found');
}

function stream_media(string $path): void
{
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime  = finfo_file($finfo, $path);
    finfo_close($finfo);

    $allowed = [
        'image/jpeg', 'image/png', 'image/webp',
        'video/mp4', 'video/webm', 'video/quicktime',
    ];
    if (!in_array($mime, $allowed, true)) {
        media_fail(404, 'Media not found');
    }

    // Uploaded files get a random name and are never rewritten in place, so a
    // browser can keep them for a long time instead of re-downloading videos.
    header('Cache-Control: public, max-age=2592000, immutable');
    header('X-Content-Type-Options: nosniff');
    stream_file_with_ranges($path, (string)$mime);
}

function media_path_in_root(string $root, string $filename): ?string
{
    $path = realpath($root . DIRECTORY_SEPARATOR . basename($filename));
    $prefix = rtrim($root, '/\\') . DIRECTORY_SEPARATOR;
    return $path !== false && str_starts_with($path, $prefix) && is_file($path) ? $path : null;
}

// 1) ?file=filename.png
if (isset($_GET['file']) && $_GET['file'] !== '') {
    if (!is_string($_GET['file'])) {
        media_fail(400, 'Invalid file');
    }
    $path = media_path_in_root($imageDir, $_GET['file']);
    if ($path === null) {
        media_fail(404, 'Image not found');
    }
    stream_media($path);
}

// 2) ?url=/data/images/filename.png OR /media/review-images/filename.jpg
if (isset($_GET['url']) && $_GET['url'] !== '') {
    if (!is_string($_GET['url'])) {
        media_fail(400, 'Invalid url');
    }
    $url = explode('?', $_GET['url'], 2)[0];

    // Private chat media is intentionally unavailable from this generic endpoint.
    if (str_starts_with($url, '/media/chat-images/') || str_starts_with($url, '/media/chat-attachments/')) {
        media_fail(404, 'Image not found');
    }

    // The prefix only picks the directory. Only the file name is used, so
    // basename() blocks traversal and media_path_in_root() blocks symlink escape.
    if (str_starts_with($url, '/media/review-images/')) {
        $root = real_upload_path(data_media_dir('review-images'));
    } elseif (str_starts_with($url, '/media/')) {
        $root = real_upload_path(data_media_dir());
    } else {
        $root = $imageDir; // /images/, legacy /data/images/, or a bare file name
    }
    $path = $root !== null ? media_path_in_root($root, basename($url)) : null;

    if ($path === null) {
        media_fail(404, 'Image not found');
    }
    stream_media($path);
}

media_fail(400, 'Missing file or url');
