<?php
/**
 * Rate Limiting for Forgot Password Requests
 * Prevents spam and abuse of the password reset functionality
 */

function check_forgot_password_rate_limit(string $email): array {
    require_once __DIR__ . '/../../db_connect.php';
    
    $conn = db();
    
    // Get current rate limit settings
    $rateLimitMinutes = get_forgot_password_rate_limit_minutes();
    
    // Check if email exists
    $stmt = $conn->prepare('SELECT user_id, last_reset_request FROM user_accounts WHERE email = ?');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        $stmt->close();
        $conn->close();
        return ['allowed' => false, 'error' => 'Email not found'];
    }
    
    $user = $result->fetch_assoc();
    $stmt->close();
    
    // If no previous request, allow it
    if (!$user['last_reset_request']) {
        return ['allowed' => true, 'message' => 'First request allowed'];
    }
    
    // Check if enough time has passed
    $lastRequest = new DateTime($user['last_reset_request']);
    $now = new DateTime();
    $timeDiff = $now->diff($lastRequest);
    $minutesPassed = ($timeDiff->days * 24 * 60) + ($timeDiff->h * 60) + $timeDiff->i;
    
    if ($minutesPassed < $rateLimitMinutes) {
        $remainingMinutes = $rateLimitMinutes - $minutesPassed;
        return [
            'allowed' => false, 
            'error' => "Please wait {$remainingMinutes} minutes before requesting another reset link"
        ];
    }
    
    $conn->close();
    return ['allowed' => true, 'message' => 'Rate limit passed'];
}

function update_reset_request_timestamp(string $email): void {
    require_once __DIR__ . '/../../db_connect.php';
    
    $conn = db();
    $stmt = $conn->prepare('UPDATE user_accounts SET last_reset_request = NOW() WHERE email = ?');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $stmt->close();
    $conn->close();
}

function get_forgot_password_rate_limit_minutes(): int {
    // For local testing: 1 minute (instead of 0 to prevent spam)
    // For production: 10 minutes between requests
    $isLocalhost = (
        $_SERVER['HTTP_HOST'] === 'localhost' ||
        $_SERVER['HTTP_HOST'] === 'localhost:8080' ||
        strpos($_SERVER['HTTP_HOST'], '127.0.0.1') === 0
    );
    
    return $isLocalhost ? 1 : 10;
}
?>
