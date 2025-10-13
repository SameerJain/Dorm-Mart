<?php
/**
 * Authentication utility function
 * Validates the auth_token cookie against the hash_auth in database
 * Returns the authenticated user_id or exits with 401 if not authenticated
 */

function has_auth() {
    // Check if auth_token cookie exists
    if (!isset($_COOKIE['auth_token']) || empty($_COOKIE['auth_token'])) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Unauthorized - No auth token']);
        exit;
    }
    
    $authToken = $_COOKIE['auth_token'];
    
    // Validate token format (should be 64 hex characters)
    if (!preg_match('/^[a-f0-9]{64}$/i', $authToken)) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Unauthorized - Invalid token format']);
        exit;
    }
    
    // Connect to database
    require_once __DIR__ . '/../../db_connect.php';
    $conn = db();
    
    try {
        // Get all users with non-null hash_auth
        $stmt = $conn->prepare('SELECT user_id, hash_auth FROM user_accounts WHERE hash_auth IS NOT NULL');
        $stmt->execute();
        $result = $stmt->get_result();
        
        // Check each hash_auth to see if it matches the provided token
        while ($row = $result->fetch_assoc()) {
            if (password_verify($authToken, $row['hash_auth'])) {
                // Token matches this user
                $stmt->close();
                $conn->close();
                return (int)$row['user_id'];
            }
        }
        
        // No matching token found
        $stmt->close();
        $conn->close();
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Unauthorized - Invalid or expired token']);
        exit;
        
    } catch (Throwable $e) {
        if (isset($conn)) {
            $conn->close();
        }
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Server error']);
        exit;
    }
}
?>

