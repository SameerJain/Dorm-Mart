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
