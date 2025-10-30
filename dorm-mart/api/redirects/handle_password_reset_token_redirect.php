<?php
// Handle password reset token redirects
// Redirect to the password reset page with the token

$host = $_SERVER['HTTP_HOST'] ?? '';
$token = $_GET['token'] ?? '';

// Validate token exists
if (empty($token)) {
    // No token provided, redirect to login with error
    if (strpos($host, 'cattle.cse.buffalo.edu') !== false) {
        header('Location: https://cattle.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/#/login?error=invalid_reset_link');
    } elseif (strpos($host, 'aptitude.cse.buffalo.edu') !== false) {
        header('Location: https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/#/login?error=invalid_reset_link');
    } elseif (strpos($host, ':8080') !== false) {
        // PHP dev server - redirect to React dev server
        header('Location: http://localhost:3000/#/login?error=invalid_reset_link');
    } else {
        // Apache serve folder
        header('Location: /serve/dorm-mart/#/login?error=invalid_reset_link');
    }
    exit;
}

// Redirect to password reset page with token
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
