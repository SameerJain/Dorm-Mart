<?php
declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/response.php';

if (!function_exists('init_json_endpoint')) {
    function init_json_endpoint(?string $method = null, array $methodErrorPayload = ['success' => false, 'error' => 'Method Not Allowed']): void
    {
        set_security_headers();
        set_secure_cors();

        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
        }

        allow_options_request();

        if ($method !== null) {
            require_request_method($method, $methodErrorPayload);
        }
    }
}
