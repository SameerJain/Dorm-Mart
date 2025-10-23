<?php

declare(strict_types=1);

// Include security headers for XSS protection
require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();
// Ensure CORS headers are present for React dev server and local PHP server
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

// HTTPS enforcement for production (exclude localhost for development)
$isLocalhost = (
    $_SERVER['HTTP_HOST'] === 'localhost' ||
    $_SERVER['HTTP_HOST'] === 'localhost:8080' ||
    strpos($_SERVER['HTTP_HOST'], '127.0.0.1') === 0
);

if (!$isLocalhost && (!isset($_SERVER['HTTPS']) || $_SERVER['HTTPS'] !== 'on')) {
    $httpsUrl = 'https://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
    header("Location: $httpsUrl", true, 301);
    exit;
}

require __DIR__ . '/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';

// Respond to CORS preflight after setting CORS headers
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Rate limiting will be checked after recording failed attempts
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method Not Allowed']);
    exit;
}

$ct = $_SERVER['CONTENT_TYPE'] ?? '';
if (strpos($ct, 'application/json') !== false) {
    $raw  = file_get_contents('php://input');
    $data = sanitize_json($raw) ?: [];
    $email = validateInput(strtolower(trim((string)($data['email'] ?? ''))), 50, '/^[^@\s]+@buffalo\.edu$/');
    $password = validateInput((string)($data['password'] ?? ''), 64);
} else {
    $email = validateInput(strtolower(trim((string)($_POST['email'] ?? ''))), 50, '/^[^@\s]+@buffalo\.edu$/');
    $password = validateInput((string)($_POST['password'] ?? ''), 64);
}

if ($email === false || $password === false) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid input format']);
    exit;
}

if ($email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing required fields']);
    exit;
}
if (strlen($email) >= 50 || strlen($password) >= 64) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Username or password is too large']);
    exit;
}
if (!preg_match('/^[^@\s]+@buffalo\.edu$/', $email)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Email must be @buffalo.edu']);
    exit;
}

try {
    $conn = db();
    $stmt = $conn->prepare('SELECT user_id, hash_pass, failed_login_attempts, last_failed_attempt FROM user_accounts WHERE email = ? LIMIT 1');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $res = $stmt->get_result();

    if ($res->num_rows === 0) {
        $stmt->close();
        $conn->close();
        
        // Check rate limiting FIRST to see if already blocked
        $rateLimitCheck = check_rate_limit($email);
        if ($rateLimitCheck['blocked']) {
            $remainingMinutes = get_remaining_lockout_minutes($rateLimitCheck['lockout_until']);
            http_response_code(429);
            echo json_encode(['ok' => false, 'error' => "Too many failed attempts. Please try again in {$remainingMinutes} minutes."]);
            exit;
        }
        
        // Record failed attempt for non-existent user (but don't reveal this)
        record_failed_attempt($email);
        
        // Check rate limiting AGAIN after recording to see if we just hit the limit
        $rateLimitCheck = check_rate_limit($email);
        if ($rateLimitCheck['blocked']) {
            $remainingMinutes = get_remaining_lockout_minutes($rateLimitCheck['lockout_until']);
            http_response_code(429);
            echo json_encode(['ok' => false, 'error' => "Too many failed attempts. Please try again in {$remainingMinutes} minutes."]);
            exit;
        }
        
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Invalid credentials']);
        exit;
    }
    $row = $res->fetch_assoc();
    $stmt->close();

    // SECURITY NOTE: password_verify() safely checks the submitted
    // plaintext against the STORED salted hash from password_hash(). The salt is
    // inside the hash; we never store or handle it separately.
    if (!password_verify($password, (string)$row['hash_pass'])) {
        $conn->close();
        
        // Check rate limiting FIRST to see if already blocked
        $rateLimitCheck = check_rate_limit($email);
        if ($rateLimitCheck['blocked']) {
            $remainingMinutes = get_remaining_lockout_minutes($rateLimitCheck['lockout_until']);
            http_response_code(429);
            echo json_encode(['ok' => false, 'error' => "Too many failed attempts. Please try again in {$remainingMinutes} minutes."]);
            exit;
        }
        
        // Record failed attempt
        record_failed_attempt($email);
        
        // Check rate limiting AGAIN after recording to see if we just hit the limit
        $rateLimitCheck = check_rate_limit($email);
        if ($rateLimitCheck['blocked']) {
            $remainingMinutes = get_remaining_lockout_minutes($rateLimitCheck['lockout_until']);
            http_response_code(429);
            echo json_encode(['ok' => false, 'error' => "Too many failed attempts. Please try again in {$remainingMinutes} minutes."]);
            exit;
        }
        
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Invalid credentials']);
        exit;
    }

    $userId = (int)$row['user_id'];
    $conn->close();

    // Regenerate session ID to prevent session fixation attacks
    regenerate_session_on_login();
    $_SESSION['user_id'] = $userId;

    // Persist across restarts
    issue_remember_cookie($userId);

    echo json_encode(['ok' => true]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Server error']);
}