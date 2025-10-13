<?php

header('Content-Type: application/json; charset=utf-8');

// CORS for credentials - must specify origin, not '*'
$allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://aptitude.cse.buffalo.edu'
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: http://localhost:3000");
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Enforce POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method Not Allowed']);
    exit;
}

// Check if user has auth token
if (!isset($_COOKIE['auth_token']) || empty($_COOKIE['auth_token'])) {
    // No token to clear, but that's okay
    http_response_code(200);
    echo json_encode(['ok' => true, 'message' => 'Already logged out']);
    exit;
}

$authToken = $_COOKIE['auth_token'];

// Clear the hash_auth from database
require __DIR__ . '/../db_connect.php';
$conn = db();

try {
    // Find user with matching token and clear their hash_auth
    $stmt = $conn->prepare('SELECT user_id, hash_auth FROM user_accounts WHERE hash_auth IS NOT NULL');
    $stmt->execute();
    $result = $stmt->get_result();
    
    $userId = null;
    while ($row = $result->fetch_assoc()) {
        if (password_verify($authToken, $row['hash_auth'])) {
            $userId = $row['user_id'];
            break;
        }
    }
    $stmt->close();
    
    // Clear the hash_auth for this user
    if ($userId !== null) {
        $updateStmt = $conn->prepare('UPDATE user_accounts SET hash_auth = NULL WHERE user_id = ?');
        $updateStmt->bind_param('i', $userId);
        $updateStmt->execute();
        $updateStmt->close();
    }
    
    $conn->close();
    
    // Destroy the PHP session
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', $params['secure'] ?? false, $params['httponly'] ?? true);
    }
    session_destroy();
    
    // Clear the auth_token cookie (root path)
    setcookie('auth_token', '', [
        'expires' => time() - 3600,
        'path' => '/',
        'httponly' => true,
        'secure' => false  // Must match login.php setting
    ]);
    // Also clear any legacy cookie set on /serve/dorm-mart
    setcookie('auth_token', '', [
        'expires' => time() - 3600,
        'path' => '/serve/dorm-mart',
        'httponly' => true,
        'secure' => false
    ]);
    
    // Clear the non-httpOnly UI cookie
    setcookie('logged_in', '', [
        'expires' => time() - 3600,
        'path' => '/',
        'httponly' => false,
        'secure' => false
    ]);
    // Also clear any legacy UI cookie set on /serve/dorm-mart
    setcookie('logged_in', '', [
        'expires' => time() - 3600,
        'path' => '/serve/dorm-mart',
        'httponly' => false,
        'secure' => false
    ]);
    
    http_response_code(200);
    echo json_encode(['ok' => true, 'message' => 'Logged out successfully']);
    
} catch (Throwable $e) {
    if (isset($conn)) {
        $conn->close();
    }
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Server error']);
}
?>

