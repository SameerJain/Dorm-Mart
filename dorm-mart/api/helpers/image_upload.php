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
