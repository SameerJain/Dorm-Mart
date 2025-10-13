<?php

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

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

// Validate input lengths (prevent excessively large inputs)
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

    // Success - return user_id for frontend use
    $userId = $row['user_id'];
    $conn->close();
    
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
