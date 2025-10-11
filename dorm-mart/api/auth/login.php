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

// Read JSON body
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid JSON body']);
    exit;
}

$email = strtolower(trim($data['email'] ?? ''));
$password = (string)($data['password'] ?? '');

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
        // Generic auth failure response (no existence leak)
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
    echo json_encode([
        'ok' => true,
        'user_id' => $userId
    ]);
} catch (Throwable $e) {
    if (isset($conn)) {
        $conn->close();
    }
    // Log error server-side (optional): error_log($e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Server error']);
}

?>


