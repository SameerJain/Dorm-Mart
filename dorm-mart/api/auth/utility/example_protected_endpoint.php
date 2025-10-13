<?php
/**
 * Example Protected Endpoint
 * Demonstrates how to use has_auth() to protect API endpoints
 * 
 * Usage: Any endpoint that requires authentication should include has_auth()
 */

header('Content-Type: application/json; charset=utf-8');

// CORS for credentials - must specify origin, not '*'
$allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://aptitude.cse.buffalo.edu'
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: http://localhost:3000");
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Require authentication
require_once __DIR__ . '/has_auth.php';
$userId = has_auth(); // Returns user_id or exits with 401 if not authenticated

// If we reach here, user is authenticated
// $userId contains the authenticated user's ID

// Your protected endpoint logic here...
http_response_code(200);
echo json_encode([
    'ok' => true,
    'message' => 'This is a protected endpoint',
    'user_id' => $userId,
    'data' => [
        // Your protected data here
    ]
]);
?>

