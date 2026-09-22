<?php
/**
 * Integration test: reset_password rejects invalid/expired tokens.
 * API: auth/reset_password.php (expects JSON token + uid + newPassword, all required).
 *
 * reset_password.php checks field presence/shape (token must be 64 hex
 * chars, uid must be > 0) BEFORE it ever looks up the token, and returns the
 * same generic "Token, user ID, and new password are required" message for
 * that. Without a uid, every request used to fail there instead of reaching
 * the actual token-lookup — so this always reported a false PASS by luck
 * (that message doesn't contain "invalid"/"expired" either, so really it
 * would have quietly started failing the moment reset_password.php began
 * requiring uid). Defaults now include a syntactically valid token (64 hex
 * chars, just not one stored for anyone) and a uid, so the request reaches
 * real token-lookup logic and gets "Invalid or expired reset token" for the
 * right reason. Override token/uid via JSON to test a specific captured
 * token instead.
 *
 * Set API_TEST_BASE_URL if auto-detection fails (e.g. CLI).
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/bootstrap.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = [];
}

$token = isset($input['token']) && is_string($input['token']) && $input['token'] !== ''
    ? trim($input['token'])
    : bin2hex(random_bytes(32));
$uid = isset($input['uid']) ? (int) $input['uid'] : 1;
// Policy-valid password so the server reaches token validation (not policy errors).
$newPassword = isset($input['newPassword']) ? (string) $input['newPassword'] : 'Valid1!a';

$result = api_test_post_json('auth/reset_password.php', [
    'token' => $token,
    'uid' => $uid,
    'newPassword' => $newPassword,
]);

$response = is_array($result['json']) ? $result['json'] : [];
$error = isset($response['error']) ? (string) $response['error'] : '';

$looksLikeInvalidToken = $error !== ''
    && (stripos($error, 'expired') !== false || stripos($error, 'invalid') !== false);

if ($looksLikeInvalidToken) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'test_result' => 'PASS — API rejected token: ' . $error,
        'api_http_code' => $result['http_code'],
        'api_response' => $response,
    ]);
    exit;
}

http_response_code(200);
echo json_encode([
    'success' => false,
    'test_result' => 'FAIL — expected invalid/expired token message from API',
    'api_http_code' => $result['http_code'],
    'api_response' => $response,
    'api_raw' => $result['raw'],
]);
