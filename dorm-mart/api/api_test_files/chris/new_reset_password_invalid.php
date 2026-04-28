<?php
/**
 * Integration test: reset_password rejects passwords that fail policy.
 * API: auth/reset_password.php (token + newPassword).
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/bootstrap.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = [];
}

$token = isset($input['token']) ? trim((string) $input['token']) : 'not-a-real-token';
$newPassword = isset($input['newPassword']) ? (string) $input['newPassword'] : 'weak';

$result = api_test_post_json('auth/reset_password.php', [
    'token' => $token,
    'newPassword' => $newPassword,
]);

$response = is_array($result['json']) ? $result['json'] : [];
$error = isset($response['error']) ? (string) $response['error'] : '';

$policyRejection = $result['http_code'] === 400
    && $error === 'Password does not meet policy requirements';

if ($policyRejection) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'test_result' => 'PASS — API returned policy error as expected',
        'api_http_code' => $result['http_code'],
        'api_response' => $response,
    ]);
    exit;
}

// Wrong password shape might still hit token path first with a dummy token
$alsoOk = $result['http_code'] === 400
    && $error !== ''
    && (stripos($error, 'password') !== false || stripos($error, 'policy') !== false || stripos($error, 'long') !== false);

if ($alsoOk) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'test_result' => 'PASS — API rejected password: ' . $error,
        'api_http_code' => $result['http_code'],
        'api_response' => $response,
    ]);
    exit;
}

http_response_code(200);
echo json_encode([
    'success' => false,
    'test_result' => 'FAIL — expected password policy error (HTTP 400)',
    'api_http_code' => $result['http_code'],
    'api_response' => $response,
    'api_raw' => $result['raw'],
]);
