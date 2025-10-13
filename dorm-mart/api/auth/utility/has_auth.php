<?php
/**
 * Authentication Helper
 * 
 * Checks if the user is authenticated via the auth_token cookie.
 * Returns the user_id if authenticated, or exits with 401 if not.
 * 
 * Usage in your endpoint:
 *   require_once __DIR__ . '/utility/has_auth.php';
 *   $userId = has_auth();
 *   // Now you have the authenticated user's ID
 */

function has_auth() {
    // First, accept a valid PHP session
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    if (isset($_SESSION['user_id']) && is_numeric($_SESSION['user_id'])) {
        return (int)$_SESSION['user_id'];
    }
    
    // Fallback: validate auth_token cookie against hash_auth
    if (!isset($_COOKIE['auth_token']) || empty($_COOKIE['auth_token'])) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
        exit;
    }
    $authToken = $_COOKIE['auth_token'];
    
    require_once __DIR__ . '/../../db_connect.php';
    $conn = db();
    
    try {
        $stmt = $conn->prepare('SELECT user_id, hash_auth FROM user_accounts WHERE hash_auth IS NOT NULL');
        $stmt->execute();
        $result = $stmt->get_result();
        while ($row = $result->fetch_assoc()) {
            if (password_verify($authToken, $row['hash_auth'])) {
                $stmt->close();
                $conn->close();
                return (int)$row['user_id'];
            }
        }
        $stmt->close();
        $conn->close();
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
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

