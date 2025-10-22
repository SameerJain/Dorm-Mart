<?php
// Reset Password Page - Serves React component for password reset
$token = $_GET['token'] ?? '';

// Check if token is valid and not expired
$isValidToken = false;
if (!empty($token)) {
    require_once __DIR__ . '/../database/db_connect.php';
    $conn = db();
    
    // Check if token is valid and not expired
    // Verifies token exists in database and hasn't expired
    $stmt = $conn->prepare('
        SELECT user_id, hash_auth, reset_token_expires 
        FROM user_accounts 
        WHERE hash_auth IS NOT NULL 
        AND reset_token_expires > NOW()
    ');
    $stmt->execute();
    $result = $stmt->get_result();
    
    while ($row = $result->fetch_assoc()) {
        if (password_verify($token, $row['hash_auth'])) {
            $isValidToken = true;
            break;
        }
    }
    
    $stmt->close();
    $conn->close();
    
    // If token is invalid or expired, redirect to expired page
    if (!$isValidToken) {
        // Detect environment and redirect to correct path
        $host = $_SERVER['HTTP_HOST'] ?? '';
        
        if (strpos($host, 'aptitude.cse.buffalo.edu') !== false) {
            header('Location: /CSE442/2025-Fall/cse-442j/api/redirects/show_password_reset_link_expired_page.php');
        } elseif (strpos($host, 'cattle.cse.buffalo.edu') !== false) {
            header('Location: /CSE442/2025-Fall/cse-442j/api/redirects/show_password_reset_link_expired_page.php');
        } else {
            // Local development - detect if using PHP dev server or Apache
            if (strpos($host, ':8080') !== false) {
                // PHP dev server
                header('Location: /api/redirects/show_password_reset_link_expired_page.php');
            } else {
                // Apache serve folder
                header('Location: /serve/dorm-mart/api/redirects/show_password_reset_link_expired_page.php');
            }
        }
        exit;
    }
}

// If no token provided, show error
if (empty($token)) {
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (strpos($host, ':8080') !== false) {
        // PHP dev server - redirect to React dev server
        header('Location: http://localhost:3000/#/login?error=invalid_reset_link');
    } else {
        // Apache serve folder
        header('Location: /serve/dorm-mart/#/login?error=invalid_reset_link');
    }
    exit;
}

// Detect environment and redirect to React app with token
$host = $_SERVER['HTTP_HOST'] ?? '';

// Production servers
if (strpos($host, 'cattle.cse.buffalo.edu') !== false) {
    header('Location: https://cattle.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/#/reset-password?token=' . urlencode($token));
} elseif (strpos($host, 'aptitude.cse.buffalo.edu') !== false) {
    header('Location: https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/#/reset-password?token=' . urlencode($token));
} elseif (strpos($host, ':8080') !== false) {
    // PHP dev server - redirect to React dev server
    header('Location: http://localhost:3000/#/reset-password?token=' . urlencode($token));
} else {
    // Apache serve folder
    header('Location: /serve/dorm-mart/#/reset-password?token=' . urlencode($token));
}
exit;
?>
