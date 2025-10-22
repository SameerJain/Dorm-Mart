<?php
// Test file for invalid email (not in database)
// This simulates the forgot password request for an email that doesn't exist

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Get the request body
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data || !isset($data['email'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email is required']);
    exit;
}

$email = $data['email'];

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !str_ends_with($email, '@buffalo.edu')) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email must be a valid UB email address']);
    exit;
}

// Simulate the response for an email that doesn't exist in the database
// In the real implementation, this would be handled by the actual forgot-password.php
// but for testing purposes, we'll simulate the "Email not found" response

http_response_code(200);
echo json_encode([
    'success' => false,
    'error' => 'Email not found'
]);
?>
