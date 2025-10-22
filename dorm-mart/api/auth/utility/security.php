<?php
// XSS Protection Helper Functions

function escapeHtml($str) {
    return htmlspecialchars($str ?? '', ENT_QUOTES, 'UTF-8');
}

function escapeJson($str) {
    return json_encode($str ?? '', JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP);
}

function validateInput($input, $maxLength = 255, $allowedChars = null) {
    $input = trim($input);
    if (strlen($input) > $maxLength) {
        return false;
    }
    if ($allowedChars && !preg_match($allowedChars, $input)) {
        return false;
    }
    return $input;
}

function setSecurityHeaders() {
    header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;");
    header("X-Content-Type-Options: nosniff");
    header("X-Frame-Options: DENY");
    header("Referrer-Policy: strict-origin-when-cross-origin");
}

function setSecureCORS() {
    // SECURE CORS Configuration - Only allow specific trusted origins
    $allowedOrigins = [
        'http://localhost:3000',      // React dev server
        'http://localhost:8080',      // PHP dev server
        'https://aptitude.cse.buffalo.edu',  // Test server
        'https://cattle.cse.buffalo.edu'    // Production server
    ];
    
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    
    // Only allow exact matches from our trusted origins list
    if (in_array($origin, $allowedOrigins)) {
        header("Access-Control-Allow-Origin: $origin");
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    } else {
        // Reject requests from untrusted origins
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'Origin not allowed']);
        exit;
    }
}

function validateUserAccess($requestedUserId, $loggedInUserId) {
    // IDOR Protection - Ensure user can only access their own data
    if ($requestedUserId != $loggedInUserId) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'Permission denied - cannot access other user data']);
        exit;
    }
}
?>
