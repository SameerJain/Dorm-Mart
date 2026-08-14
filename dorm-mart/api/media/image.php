<?php
declare(strict_types=1);

// dorm-mart/api/media/image.php
// Serves images that are stored under /images/ on disk
// Accepts either ?file=filename.png OR ?url=/images/filename.png

// Include security utilities
require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../helpers/image_upload.php';
set_security_headers();
set_secure_cors();

// Must match upload_profile_photo.php / product_listing.php: uploads honor DATA_UPLOADS_DIR.
$IMAGE_DIR = real_upload_path(data_images_dir());
if ($IMAGE_DIR === null) {
    http_response_code(500);
    exit('Image directory not found');
}

function stream_image(string $path): void {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime  = finfo_file($finfo, $path);
    finfo_close($finfo);

    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}

// 1) ?file=filename.png
if (isset($_GET['file']) && $_GET['file'] !== '') {
    $file = basename($_GET['file']);
    $path = $IMAGE_DIR . DIRECTORY_SEPARATOR . $file;
    if (!file_exists($path)) {
        http_response_code(404);
        exit('Image not found');
    }
    stream_image($path);
}

// 2) ?url=/data/images/filename.png OR /media/review-images/filename.jpg OR /media/chat-images/filename.jpg
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
    if (strpos($url, $prefix) === 0) {
        $file = substr($url, strlen($prefix));
        $file = basename($file);
        $path = $IMAGE_DIR . DIRECTORY_SEPARATOR . $file;
    }
    // Handle /data/images/ paths (legacy)
    elseif (strpos($url, '/data/images/') === 0) {
        $file = substr($url, strlen('/data/images/'));
        $file = basename($file);
        $path = $IMAGE_DIR . DIRECTORY_SEPARATOR . $file;
    }
    // Handle /media/review-images/ paths
    elseif (strpos($url, '/media/review-images/') === 0) {
        $file = basename(substr($url, strlen('/media/review-images/')));
        $mediaRoot = real_upload_path(data_media_dir('review-images'));
        $mediaPath = $mediaRoot !== null ? realpath($mediaRoot . DIRECTORY_SEPARATOR . $file) : false;
        if ($mediaRoot !== null && $mediaPath !== false && strpos($mediaPath, $mediaRoot) === 0 && is_file($mediaPath)) {
            $path = $mediaPath;
        }
    }
    // Handle /media/chat-images/ paths
    elseif (strpos($url, '/media/chat-images/') === 0) {
        $file = basename(substr($url, strlen('/media/chat-images/')));
        $mediaRoot = real_upload_path(data_media_dir('chat-images'));
        $mediaPath = $mediaRoot !== null ? realpath($mediaRoot . DIRECTORY_SEPARATOR . $file) : false;
        if ($mediaRoot !== null && $mediaPath !== false && strpos($mediaPath, $mediaRoot) === 0 && is_file($mediaPath)) {
            $path = $mediaPath;
        }
    }
    // Handle /media/chat-attachments/ paths
    elseif (strpos($url, '/media/chat-attachments/') === 0) {
        $file = basename(substr($url, strlen('/media/chat-attachments/')));
        $mediaRoot = real_upload_path(data_media_dir('chat-attachments'));
        $mediaPath = $mediaRoot !== null ? realpath($mediaRoot . DIRECTORY_SEPARATOR . $file) : false;
        if ($mediaRoot !== null && $mediaPath !== false && strpos($mediaPath, $mediaRoot) === 0 && is_file($mediaPath)) {
            $path = $mediaPath;
        }
    }
    // Handle other /media/ paths — basename() prevents traversal, realpath() prevents symlink escape
    elseif (strpos($url, '/media/') === 0) {
        $file = basename(substr($url, strlen('/media/')));
        $mediaRoot = real_upload_path(data_media_dir());
        $mediaPath = $mediaRoot !== null ? realpath($mediaRoot . DIRECTORY_SEPARATOR . $file) : false;
        if ($mediaRoot !== null && $mediaPath !== false && strpos($mediaPath, $mediaRoot) === 0 && is_file($mediaPath)) {
            $path = $mediaPath;
        }
    }
    // Fallback: maybe someone passed just filename
    else {
        $file = basename($url);
        $path = $IMAGE_DIR . DIRECTORY_SEPARATOR . $file;
    }

    if ($path === null || !file_exists($path)) {
        http_response_code(404);
        exit('Image not found');
    }
    stream_image($path);
}

// if neither param present
http_response_code(400);
exit('Missing file or url');
