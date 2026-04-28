<?php
declare(strict_types=1);

if (!function_exists('json_request_body')) {
    function json_request_body(): array
    {
        $payload = json_decode(file_get_contents('php://input'), true);
        return is_array($payload) ? $payload : [];
    }
}

if (!function_exists('request_int')) {
    function request_int(array $source, string $key, int $default = 0): int
    {
        return isset($source[$key]) ? (int)$source[$key] : $default;
    }
}
