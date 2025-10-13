<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/auth_handle.php';
require __DIR__ . '/../db_connect.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['ok'=>false,'error'=>'Method Not Allowed']); exit; }

$ct = $_SERVER['CONTENT_TYPE'] ?? '';
if (strpos($ct, 'application/json') !== false) {
  $raw  = file_get_contents('php://input');
  $data = json_decode($raw, true) ?: [];
  $email = strtolower(trim((string)($data['email'] ?? '')));
  $password = (string)($data['password'] ?? '');
} else {
  $email = strtolower(trim((string)($_POST['email'] ?? '')));
  $password = (string)($_POST['password'] ?? '');
}

if ($email === '' || $password === '') { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'Missing required fields']); exit; }
if (strlen($email) >= 50 || strlen($password) >= 64) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'Username or password is too large']); exit; }
if (!preg_match('/^[^@\s]+@buffalo\.edu$/', $email)) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'Email must be @buffalo.edu']); exit; }

try {
  $conn = db();
  $stmt = $conn->prepare('SELECT user_id, hash_pass FROM user_accounts WHERE email = ? LIMIT 1');
  $stmt->bind_param('s', $email);
  $stmt->execute();
  $res = $stmt->get_result();

  if ($res->num_rows === 0) {
    $stmt->close(); $conn->close();
    http_response_code(401); echo json_encode(['ok'=>false,'error'=>'Invalid credentials']); exit;
  }
  $row = $res->fetch_assoc();
  $stmt->close();

  if (!password_verify($password, (string)$row['hash_pass'])) {
    $conn->close();
    http_response_code(401); echo json_encode(['ok'=>false,'error'=>'Invalid credentials']); exit;
  }

  $userId = (int)$row['user_id'];
  $conn->close();

  auth_boot_session();
  regenerate_session_on_login();
  $_SESSION['user_id'] = $userId;

  // Persist across restarts
  issue_remember_cookie($userId);

  echo json_encode(['ok'=>true]);
} catch (Throwable $e) {
  if (isset($stmt) && $stmt) { $stmt->close(); }
  if (isset($conn) && $conn) { $conn->close(); }
  http_response_code(500); echo json_encode(['ok'=>false,'error'=>'Server error']);
}
