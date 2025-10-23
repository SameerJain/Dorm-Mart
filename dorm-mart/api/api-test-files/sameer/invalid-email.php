<?php
// Simple test file - just returns error response immediately

// Include security utilities
require_once __DIR__ . '/../../security/security.php';
setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json');

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
