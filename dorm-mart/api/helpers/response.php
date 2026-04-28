<?php
declare(strict_types=1);

if (!function_exists('json_response')) {
    function json_response($payload, int $statusCode = 200, int $flags = 0): void
    {
        http_response_code($statusCode);
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode($payload, $flags);
        exit;
    }
}

if (!function_exists('allow_options_request')) {
    function allow_options_request(int $statusCode = 204): void
    {
        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
            http_response_code($statusCode);
            exit;
        }
    }
}

if (!function_exists('require_request_method')) {
    function require_request_method(string $method, array $payload = ['success' => false, 'error' => 'Method Not Allowed']): void
    {
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
            json_response($payload, 405);
        }
    }
}
