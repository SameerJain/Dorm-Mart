<?php
/**
 * Integration test: reset_password rejects invalid/expired tokens.
 * API: auth/reset_password.php (expects JSON token + newPassword).
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

$token = isset($input['token']) ? trim((string) $input['token']) : '';
// Policy-valid password so the server reaches token validation (not policy errors).
$newPassword = isset($input['newPassword']) ? (string) $input['newPassword'] : 'Valid1!a';

if ($token === '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Provide JSON: {"token":"your-invalid-or-expired-token"} — newPassword optional (defaults to a policy-valid value)',
    ]);
    exit;
}

$result = api_test_post_json('auth/reset_password.php', [
    'token' => $token,
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
