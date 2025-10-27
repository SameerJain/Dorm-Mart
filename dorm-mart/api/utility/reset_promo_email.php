<?php
// Utility script to reset received_intro_promo_email flag for all users
// This allows developers to test the promo email functionality multiple times

// Include security utilities
require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method Not Allowed']);
    exit;
}

require_once __DIR__ . '/../database/db_connect.php';

try {
    $conn = db();
    
    // Reset received_intro_promo_email to FALSE for all users
    $stmt = $conn->prepare('UPDATE user_accounts SET received_intro_promo_email = FALSE');
    $result = $stmt->execute();
    $affectedRows = $stmt->affected_rows;
    $stmt->close();
    
    if ($result) {
        echo json_encode([
            'ok' => true, 
            'message' => "Successfully reset promo email flag for {$affectedRows} users",
            'affected_rows' => $affectedRows
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Failed to reset promo email flags']);
    }
    
    $conn->close();
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Database error occurred']);
    error_log("reset_promo_email.php error: " . $e->getMessage());
}
