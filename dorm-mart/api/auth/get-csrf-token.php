<?php
/**
 * CSRF Token Endpoint
 * Returns a CSRF token for authenticated requests
 */

declare(strict_types=1);

// Include security headers and CORS
require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/auth_handle.php';

initSecurity();

header('Content-Type: application/json; charset=utf-8');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Allow GET requests to retrieve token
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method Not Allowed']);
    exit;
}

// Generate and return CSRF token
$token = generate_csrf_token();

echo json_encode([
    'ok' => true,
    'csrf_token' => $token
]);

