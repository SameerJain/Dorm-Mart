<?php
declare(strict_types=1);

if (!function_exists('require_multipart_formdata')) {
    function require_multipart_formdata(array $payload = ['success' => false, 'error' => 'expected_multipart_formdata']): void
    {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (stripos($contentType, 'multipart/form-data') !== 0) {
            json_response($payload, 415);
        }
    }
}

if (!function_exists('uploaded_image_info')) {
    function uploaded_image_info(array $file, int $maxBytes, array $allowedMimeExtensions): array
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            return ['ok' => false, 'error' => 'missing_image', 'status' => 400];
        }

        $tmpName = (string)($file['tmp_name'] ?? '');
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            return ['ok' => false, 'error' => 'missing_image', 'status' => 400];
        }

        $size = filesize($tmpName);
        if ($size === false || $size > $maxBytes) {
            return ['ok' => false, 'error' => 'image_too_large', 'status' => 400, 'max_bytes' => $maxBytes];
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($tmpName) ?: 'application/octet-stream';
        if (!isset($allowedMimeExtensions[$mime])) {
            return ['ok' => false, 'error' => 'unsupported_image_type', 'status' => 400];
        }
        if (!uploaded_image_dimensions_are_safe($tmpName, $mime)) {
            return ['ok' => false, 'error' => 'unsafe_image_dimensions', 'status' => 400];
        }

        return [
            'ok' => true,
            'tmp_name' => $tmpName,
            'size' => $size,
            'mime' => $mime,
            'extension' => $allowedMimeExtensions[$mime],
        ];
    }
}

if (!function_exists('ensure_upload_directory')) {
    function ensure_upload_directory(string $directory, int $mode = 0755): bool
    {
        return is_dir($directory) || @mkdir($directory, $mode, true) || is_dir($directory);
    }
}

if (!function_exists('uploaded_image_dimensions_are_safe')) {
    function uploaded_image_dimensions_are_safe(
        string $path,
        string $expectedMime,
        int $maxWidth = 10000,
        int $maxHeight = 10000,
        int $maxPixels = 25000000
    ): bool {
        if (!str_starts_with($expectedMime, 'image/')) {
            return true;
        }

        $dimensions = @getimagesize($path);
        if (!is_array($dimensions) || !isset($dimensions[0], $dimensions[1])) {
            return false;
        }
        $detectedMime = (string)($dimensions['mime'] ?? '');
        $width = (int)$dimensions[0];
        $height = (int)$dimensions[1];
        if ($detectedMime !== $expectedMime || $width <= 0 || $height <= 0
            || $width > $maxWidth || $height > $maxHeight) {
            return false;
        }

        return $width <= intdiv($maxPixels, $height);
    }
}

if (!function_exists('project_root_path')) {
    function project_root_path(): string
    {
        return dirname(__DIR__, 2);
    }
}

if (!function_exists('data_uploads_root')) {
    function data_uploads_root(): string
    {
        $projectRoot = project_root_path();
        $envRoot = getenv('DATA_UPLOADS_DIR');
        $root = $envRoot !== false && trim($envRoot) !== '' ? trim($envRoot) : $projectRoot;

        if (!preg_match('/^[A-Za-z]:[\/\\\\]/', $root) && $root[0] !== '/') {
            $root = $projectRoot . DIRECTORY_SEPARATOR . $root;
        }

        return rtrim($root, '/\\');
    }
}

if (!function_exists('data_images_dir')) {
    function data_images_dir(): string
    {
        return data_uploads_root() . DIRECTORY_SEPARATOR . 'images';
    }
}

if (!function_exists('data_media_dir')) {
    function data_media_dir(?string $subdir = null): string
    {
        $dir = data_uploads_root() . DIRECTORY_SEPARATOR . 'media';
        if ($subdir !== null && $subdir !== '') {
            $dir .= DIRECTORY_SEPARATOR . trim($subdir, '/\\');
        }
        return $dir;
    }
}

if (!function_exists('real_upload_path')) {
    function real_upload_path(string $path): ?string
    {
        $real = realpath($path);
        return $real !== false ? $real : null;
    }
}

if (!function_exists('listing_media_urls')) {
    /** Decode an INVENTORY.photos value into a flat list of media URLs. */
    function listing_media_urls($stored): array
    {
        if (!is_string($stored) || $stored === '') {
            return [];
        }
        $decoded = json_decode($stored, true);
        if (is_array($decoded)) {
            return array_values(array_filter($decoded, 'is_string'));
        }
        return array_values(array_filter(array_map('trim', explode(',', $stored)), fn($v) => $v !== ''));
    }
}

if (!function_exists('delete_owned_listing_media')) {
    /**
     * Delete listing media files that this seller uploaded themselves.
     *
     * Mirrors account_delete_owned_images(): only files under /images/ whose
     * name carries this user's img_u<id>_ upload prefix are touched, so the
     * stock images that seeded listings share are never removed. Call it after
     * the database change commits -- a rolled-back write must not lose files.
     */
    function delete_owned_listing_media(array $urls, int $userId): void
    {
        if ($userId <= 0) {
            return;
        }
        $imagesDir = rtrim(data_images_dir(), '/\\');
        $prefix = 'img_u' . $userId . '_';
        foreach (array_unique($urls) as $value) {
            if (!is_string($value)) {
                continue;
            }
            $path = parse_url($value, PHP_URL_PATH);
            if (!is_string($path) || !str_starts_with($path, '/images/')) {
                continue;
            }
            $filename = basename(rawurldecode($path));
            if (!str_starts_with($filename, $prefix)) {
                continue;
            }
            $file = $imagesDir . DIRECTORY_SEPARATOR . $filename;
            if (is_file($file) && !@unlink($file)) {
                error_log('Failed to delete listing media: ' . $filename);
            }
        }
    }
}
