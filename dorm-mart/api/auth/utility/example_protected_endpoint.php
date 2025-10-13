<?php
/**
 * Example Protected Endpoint
 * 
 * This demonstrates how to protect an API endpoint using cookie authentication.
 * Only authenticated users can access this endpoint.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Check authentication - this will exit with 401 if not authenticated
require_once __DIR__ . '/has_auth.php';
$userId = has_auth();

// If we get here, the user is authenticated!
// The $userId variable contains their user_id from the database

// Example: Get some user-specific data
require_once __DIR__ . '/../../db_connect.php';
$conn = db();

try {
    $stmt = $conn->prepare('SELECT first_name, last_name, email FROM user_accounts WHERE user_id = ?');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();
    $conn->close();
    
    http_response_code(200);
    echo json_encode([
        'ok' => true,
        'message' => 'You are authenticated!',
        'user_id' => $userId,
        'user' => $user
    ]);
    
} catch (Throwable $e) {
    if (isset($conn)) {
        $conn->close();
    }
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Server error']);
}
?>
