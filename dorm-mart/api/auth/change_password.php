<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
init_json_endpoint('POST', ['ok' => false, 'error' => 'Method Not Allowed']);

require_once __DIR__ . '/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/request.php';

auth_boot_session();
$userId = require_login();

/* Read body (JSON or form) - IMPORTANT: Do NOT HTML-encode passwords before hashing */
$ct = $_SERVER['CONTENT_TYPE'] ?? '';
$data = strpos($ct, 'application/json') !== false
  ? json_request_body_or_error(['ok' => false, 'error' => 'Invalid JSON payload'])
  : $_POST;
// Passwords must remain raw - they're hashed, not displayed
$current = is_string($data['currentPassword'] ?? null) ? $data['currentPassword'] : '';
$next = is_string($data['newPassword'] ?? null) ? $data['newPassword'] : '';
require_csrf_token($data['csrf_token'] ?? null);

/* Validate inputs */
$MAX_LEN = 64;
if ($current === '' || $next === '') {
  json_response(['ok' => false, 'error' => 'Missing required fields'], 400);
}
if (strlen($current) > $MAX_LEN || strlen($next) > $MAX_LEN) {
  json_response(['ok' => false, 'error' => 'Entered password is too long'], 400);
}
if (!validate_password_policy($next)) {
  json_response(['ok' => false, 'error' => 'Password does not meet policy'], 400);
}

$conn = null;
try {
  $conn = db();

  // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
  $stmt = $conn->prepare('SELECT hash_pass, is_protected FROM user_accounts WHERE user_id = ? LIMIT 1');
  $stmt->bind_param('i', $userId);  // 'i' = integer type, safely bound as parameter
  $stmt->execute();
  $row = $stmt->get_result()->fetch_assoc();
  $stmt->close();

  if (!$row) {
    $conn->close();
    json_response(['ok' => false, 'error' => 'User not found'], 404);
  }

  $isProtected = (int)($row['is_protected'] ?? 0) === 1;

  $passwordLimit = consume_password_confirm_attempt($userId);
  if ($passwordLimit['blocked']) {
    $conn->close();
    json_response(password_confirm_retry_error($passwordLimit), 429);
  }

  // SECURITY NOTE: password_verify() safely checks the submitted password.
  if (!password_verify($current, (string)$row['hash_pass'])) {
    $conn->close();
    json_response(['ok' => false, 'error' => 'Invalid current password'], 401);
  }
  clear_password_confirm_attempts($userId);

  /* Optional: reject reuse of the same password */
  if (password_verify($next, (string)$row['hash_pass'])) {
    $conn->close();
    json_response(['ok' => false, 'error' => 'New password must differ from current'], 400);
  }

  // Seeded demo/test accounts are shared, so their password stays fixed. Say so
  // plainly: the old fake success told users their password had changed and
  // sent them to the login page while nothing had happened.
  if ($isProtected) {
    $conn->close();
    json_response(['ok' => false, 'error' => "This shared demo account's password can't be changed."], 403);
  }

  // SECURITY NOTE: password_hash() stores only the salted bcrypt hash.
  $newHash = hash_password($next);

  // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
  $upd = $conn->prepare(
    'UPDATE user_accounts
     SET hash_pass = ?, hash_auth = NULL, reset_token_hash = NULL,
         reset_token_expires = NULL, last_reset_request = NULL,
         auth_version = auth_version + 1
     WHERE user_id = ?'
  );
  $upd->bind_param('si', $newHash, $userId);  // 's' = string, 'i' = integer
  $upd->execute();
  $upd->close();
  $conn->close();
  $conn = null;
  mark_all_login_devices_signed_out($userId);

  /* Rotate session id and log out to force re-auth */
  session_regenerate_id(true);

  // End the session so the client must log in again (your UI already redirects)
  logout_destroy_session();

  json_response(['ok' => true]);
} catch (Throwable $e) {
  // Statements are closed where they are used; only the connection can still be open.
  if ($conn instanceof mysqli) {
    try { $conn->close(); } catch (Throwable $_) {}
  }
  error_log('change_password error: ' . $e->getMessage());
  json_response(['ok' => false, 'error' => 'Server error'], 500);
}
