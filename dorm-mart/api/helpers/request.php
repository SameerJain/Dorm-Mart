<?php
declare(strict_types=1);

require_once __DIR__ . '/response.php';

if (!function_exists('json_request_body')) {
    function json_request_body(): array
    {
        $payload = json_decode(file_get_contents('php://input'), true);
        return is_array($payload) ? $payload : [];
    }
}

if (!function_exists('json_request_body_or_error')) {
    function json_request_body_or_error(array $errorPayload = ['success' => false, 'error' => 'Invalid JSON payload']): array
    {
        $raw = file_get_contents('php://input');
        $payload = json_decode($raw, true);

        if (!is_array($payload)) {
            json_response($errorPayload, 400);
        }

        return $payload;
    }
}

if (!function_exists('request_int')) {
    function request_int(array $source, string $key, int $default = 0): int
    {
        return isset($source[$key]) ? (int)$source[$key] : $default;
    }
}

if (!function_exists('validate_password_policy')) {
    function validate_password_policy(string $password): bool
    {
        return strlen($password) >= 8
            && preg_match('/[a-z]/', $password)
            && preg_match('/[A-Z]/', $password)
            && preg_match('/\d/', $password)
            && (bool) preg_match('/[^A-Za-z0-9]/', $password);
    }
}
