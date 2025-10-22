<?php
/**
 * Rate Limiting for Forgot Password Requests
 * Prevents spam and abuse of the password reset functionality
 */

function check_forgot_password_rate_limit(string $email): array {
    require_once __DIR__ . '/../database/db_connect.php';
    
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
    
    // Check if enough time has passed using database comparison
    $conn = db();
    $stmt = $conn->prepare('SELECT TIMESTAMPDIFF(MINUTE, ?, NOW()) as minutes_passed');
    $stmt->bind_param('s', $user['last_reset_request']);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $minutesPassed = (int)$row['minutes_passed'];
    $stmt->close();
    $conn->close();
    
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
    require_once __DIR__ . '/../database/db_connect.php';
    
    $conn = db();
    $stmt = $conn->prepare('UPDATE user_accounts SET last_reset_request = NOW() WHERE email = ?');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $stmt->close();
    $conn->close();
}

function get_forgot_password_rate_limit_minutes(): int {
    // 10 minutes between requests for all environments (local, Aptitude, Cattle)
    return 10;
}

// Standalone script to clear forgot password rate limits
if (basename(__FILE__) === basename($_SERVER['SCRIPT_NAME'])) {
    require_once __DIR__ . '/../database/db_connect.php';
    
    $conn = db();
    $stmt = $conn->prepare('UPDATE user_accounts SET last_reset_request = NULL');
    $result = $stmt->execute();
    $affectedRows = $stmt->affected_rows;
    $stmt->close();
    $conn->close();
    
    if ($result) {
        echo "Forgot password rate limits cleared successfully!\n";
        echo "{$affectedRows} user(s) can now request new password reset emails immediately.\n";
        echo "Rate limit: 10 minutes for all environments\n";
    } else {
        echo "Failed to clear forgot password rate limits.\n";
    }
}
?>
