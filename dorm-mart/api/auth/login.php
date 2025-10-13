<?php

header('Content-Type: application/json; charset=utf-8');

// CORS for credentials - must specify origin, not '*'
// Allow localhost (dev) and production domains
$allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://aptitude.cse.buffalo.edu'
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: http://localhost:3000"); // default
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

// Detect Content-Type and read data accordingly
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';

// Default: Read form data (application/x-www-form-urlencoded)
if (strpos($contentType, 'application/x-www-form-urlencoded') !== false) {
    $email = strtolower(trim($_POST['email'] ?? ''));
    $password = (string)($_POST['password'] ?? '');
    
// Check if Content-Type is JSON (application/json)
} elseif (strpos($contentType, 'application/json') !== false) {
    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput, true);

    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid JSON body']);
        exit;
    }

    $email = strtolower(trim($data['email'] ?? ''));
    $password = (string)($data['password'] ?? '');
} else {
    http_response_code(415);
    echo json_encode(['ok' => false, 'error' => 'Unsupported Media Type']);
    exit;
}

// Basic validation
if ($email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing required fields']);
    exit;
}

if (!preg_match('/^[^@\s]+@buffalo\.edu$/', $email)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Email must be @buffalo.edu']);
    exit;
}

require __DIR__ . '/../db_connect.php';
$conn = db();

try {
    $stmt = $conn->prepare('SELECT user_id, hash_pass FROM user_accounts WHERE email = ? LIMIT 1');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        $conn->close();
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Invalid credentials']);
        exit;
    }

    $row = $result->fetch_assoc();
    $stmt->close();
    
    $hash = $row['hash_pass'] ?? '';
    if (!is_string($hash) || $hash === '' || !password_verify($password, $hash)) {
        $conn->close();
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Invalid credentials']);
        exit;
    }

    // Success - generate auth token and set secure cookie
    $userId = $row['user_id'];
    
    // Generate secure random token (64 hex characters = 32 bytes)
    $authToken = bin2hex(random_bytes(32));
    
    // Hash the token for database storage
    $hashAuth = password_hash($authToken, PASSWORD_BCRYPT);
    
    // Store hashed token in database
    $updateStmt = $conn->prepare('UPDATE user_accounts SET hash_auth = ? WHERE user_id = ?');
    $updateStmt->bind_param('si', $hashAuth, $userId);
    $updateStmt->execute();
    $updateStmt->close();
    $conn->close();
    
    // Set secure httpOnly cookie with unhashed token (actual auth)
    // Cookie expires in 30 days
    $cookieOptions = [
        'expires' => time() + (30 * 24 * 60 * 60), // 30 days
        'path' => '/',
        'domain' => '',
        'secure' => false,     // HTTPS only - set to TRUE for production, FALSE for local HTTP dev
        'httponly' => true,    // Cannot be accessed by JavaScript
        'samesite' => 'Strict' // CSRF protection
    ];
    
    setcookie('auth_token', $authToken, $cookieOptions);
    
    // Also set a companion non-httpOnly cookie just for frontend UI state checking
    // This doesn't contain sensitive data, just a flag
    $uiCookieOptions = [
        'expires' => time() + (30 * 24 * 60 * 60),
        'path' => '/',
        'domain' => '',
        'secure' => false,     // Match auth_token setting
        'httponly' => false,   // JavaScript CAN read this one
        'samesite' => 'Strict'
    ];
    
    setcookie('logged_in', 'true', $uiCookieOptions);
    
    http_response_code(200);
    echo json_encode([ 'ok' => true, 'user_id' => $userId ]);
} catch (Throwable $e) {
    if (isset($conn)) {
        $conn->close();
    }
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Server error']);
}
?>
