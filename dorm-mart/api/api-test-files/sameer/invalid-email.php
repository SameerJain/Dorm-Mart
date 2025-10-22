<?php
// Simple test file - just returns error response immediately
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// CORS headers for cross-origin requests from React frontend

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Return error response immediately (no processing)
http_response_code(200);
echo json_encode([
    'success' => false,
    'error' => 'Email not found'
]);
