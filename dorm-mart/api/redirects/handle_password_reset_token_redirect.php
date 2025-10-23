<?php
// For this feature branch, password reset functionality is not implemented
// All reset links should redirect to login with an error message

$host = $_SERVER['HTTP_HOST'] ?? '';

// Detect environment and redirect to login with error
if (strpos($host, 'cattle.cse.buffalo.edu') !== false) {
    header('Location: https://cattle.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/#/login?error=reset_link_expired');
} elseif (strpos($host, 'aptitude.cse.buffalo.edu') !== false) {
    header('Location: https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/#/login?error=reset_link_expired');
} elseif (strpos($host, ':8080') !== false) {
    // PHP dev server - redirect to React dev server
    header('Location: http://localhost:3000/#/login?error=reset_link_expired');
} else {
    // Apache serve folder
    header('Location: /serve/dorm-mart/#/login?error=reset_link_expired');
}
exit;
