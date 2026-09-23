<?php
/**
 * Integration test: reset_password rejects passwords that fail policy.
 * API: auth/reset_password.php (token + uid + newPassword, all required).
 *
 * reset_password.php validates fields in this order: token format (64 hex
 * chars) + uid (> 0) + newPassword non-empty, THEN password length, THEN
 * password policy, THEN whether the token actually matches a stored,
 * unexpired reset_token_hash for that uid. A fake token/uid pair like the
 * old version of this test used never gets past the first check, so it
 * always hit "Token, user ID, and new password are required" — which
 * contains the substring "password" and used to be accepted by a loose
 * fallback here, making this test pass no matter what the real password
 * policy check did. To actually exercise policy validation this test writes
 * a real, valid, unexpired reset token straight into the database for a
 * dedicated local test account (the same way forgot_password.php would),
 * then submits a deliberately weak password against it.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__, 2) . '/database/db_connect.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = [];
}

$email = isset($input['email']) && is_string($input['email']) && $input['email'] !== ''
    ? $input['email']
    : 'testuser@buffalo.edu';
$newPassword = isset($input['newPassword']) ? (string) $input['newPassword'] : 'weak';

$conn = db();

$stmt = $conn->prepare('SELECT user_id FROM user_accounts WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $email);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$row) {
    echo json_encode([
        'success' => false,
        'test_result' => "FAIL — setup: no local account for {$email}. Pass {\"email\":\"...\"} for an account that exists in this environment.",
    ]);
    exit;
}

$uid = (int) $row['user_id'];
$token = bin2hex(random_bytes(32));
$hashedToken = password_hash($token, PASSWORD_BCRYPT);
$expiresAt = (new DateTime('+1 hour', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');

$stmt = $conn->prepare('UPDATE user_accounts SET reset_token_hash = ?, reset_token_expires = ? WHERE user_id = ?');
$stmt->bind_param('ssi', $hashedToken, $expiresAt, $uid);
$stmt->execute();
$stmt->close();

$result = api_test_post_json('auth/reset_password.php', [
    'token' => $token,
    'uid' => $uid,
    'newPassword' => $newPassword,
]);

// Whether the endpoint rejected or (unexpectedly) accepted the weak
// password, this test-only token must not be left valid afterward.
$stmt = $conn->prepare('UPDATE user_accounts SET reset_token_hash = NULL, reset_token_expires = NULL WHERE user_id = ? AND reset_token_hash = ?');
$stmt->bind_param('is', $uid, $hashedToken);
$stmt->execute();
$stmt->close();
$conn->close();

$response = is_array($result['json']) ? $result['json'] : [];
$error = isset($response['error']) ? (string) $response['error'] : '';

$policyRejection = $result['http_code'] === 400
    && $error === 'Password does not meet policy requirements';

if ($policyRejection) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'test_result' => 'PASS — API returned policy error as expected, with a real valid token+uid so the check was genuinely reached',
        'api_http_code' => $result['http_code'],
        'api_response' => $response,
    ]);
    exit;
}

http_response_code(200);
echo json_encode([
    'success' => false,
    'test_result' => 'FAIL — expected "Password does not meet policy requirements" (HTTP 400)',
    'api_http_code' => $result['http_code'],
    'api_response' => $response,
    'api_raw' => $result['raw'],
]);
