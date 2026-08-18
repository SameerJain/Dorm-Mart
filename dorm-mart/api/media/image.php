<?php
declare(strict_types=1);

// Serves public product, profile, and review media. Chat media requires participant auth.

// Include security utilities
require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../helpers/image_upload.php';
set_security_headers();
set_secure_cors();

// Must match upload_profile_photo.php / product_listing.php: uploads honor DATA_UPLOADS_DIR.
$imageDir = real_upload_path(data_images_dir());
if ($imageDir === null) {
    http_response_code(500);
    exit('Image directory not found');
}

function stream_media(string $path): void
{
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime  = finfo_file($finfo, $path);
    finfo_close($finfo);

    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}

function media_path_in_root(string $root, string $filename): ?string
{
    $path = realpath($root . DIRECTORY_SEPARATOR . basename($filename));
    $prefix = rtrim($root, '/\\') . DIRECTORY_SEPARATOR;
    return $path !== false && str_starts_with($path, $prefix) && is_file($path) ? $path : null;
}

// 1) ?file=filename.png
if (isset($_GET['file']) && $_GET['file'] !== '') {
    $path = media_path_in_root($imageDir, (string)$_GET['file']);
    if ($path === null) {
        http_response_code(404);
        exit('Image not found');
    }
    stream_media($path);
}

// 2) ?url=/data/images/filename.png OR /media/review-images/filename.jpg
if (isset($_GET['url']) && $_GET['url'] !== '') {
    $url = $_GET['url'];

    // strip query part if present
    $qpos = strpos($url, '?');
    if ($qpos !== false) {
        $url = substr($url, 0, $qpos);
    }

    $path = null;

    // Handle /images/ paths (profile photos and other images)
    $prefix = '/images/';
    if (str_starts_with($url, $prefix)) {
        $file = substr($url, strlen($prefix));
        $file = basename($file);
        $path = media_path_in_root($imageDir, $file);
    }
    // Handle /data/images/ paths (legacy)
    elseif (str_starts_with($url, '/data/images/')) {
        $file = substr($url, strlen('/data/images/'));
        $file = basename($file);
        $path = media_path_in_root($imageDir, $file);
    }
    // Handle /media/review-images/ paths
    elseif (str_starts_with($url, '/media/review-images/')) {
        $file = basename(substr($url, strlen('/media/review-images/')));
        $mediaRoot = real_upload_path(data_media_dir('review-images'));
        $path = $mediaRoot !== null ? media_path_in_root($mediaRoot, $file) : null;
    }
    // Private chat media is intentionally unavailable from this generic endpoint.
    elseif (str_starts_with($url, '/media/chat-images/')
        || str_starts_with($url, '/media/chat-attachments/')) {
        http_response_code(404);
        exit('Image not found');
    }
    // Handle other /media/ paths — basename() prevents traversal, realpath() prevents symlink escape
    elseif (str_starts_with($url, '/media/')) {
        $file = basename(substr($url, strlen('/media/')));
        $mediaRoot = real_upload_path(data_media_dir());
        $path = $mediaRoot !== null ? media_path_in_root($mediaRoot, $file) : null;
    }
    // Fallback: maybe someone passed just filename
    else {
        $file = basename($url);
        $path = media_path_in_root($imageDir, $file);
    }

    if ($path === null) {
        http_response_code(404);
        exit('Image not found');
    }
    stream_media($path);
}

// if neither param present
http_response_code(400);
exit('Missing file or url');
