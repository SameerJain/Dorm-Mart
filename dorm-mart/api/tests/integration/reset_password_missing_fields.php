<?php
/**
 * Replaces the old "passwords do not match" test: this API has a single newPassword field.
 * Integration test: missing token, uid, or newPassword returns 400 from reset_password.php.
 *
 * reset_password.php now also requires uid (added after this test was
 * written), and its message changed to name all three fields — the old
 * exact-match assertion here ("Token and new password are required") no
 * longer matches, which would silently report FAIL on a correctly-behaving
 * endpoint forever.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/bootstrap.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = [];
}

// Default case: empty body → API should require all three fields
$postBody = $input;
if ($postBody === []) {
    $postBody = ['token' => '', 'uid' => '', 'newPassword' => ''];
}

$result = api_test_post_json('auth/reset_password.php', $postBody);

$response = is_array($result['json']) ? $result['json'] : [];
$error = isset($response['error']) ? (string) $response['error'] : '';

$missingFields = $result['http_code'] === 400
    && $error === 'Token, user ID, and new password are required';

if ($missingFields) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'test_result' => 'PASS — API requires token, uid, and newPassword',
        'api_http_code' => $result['http_code'],
        'api_response' => $response,
    ]);
    exit;
}

http_response_code(200);
echo json_encode([
    'success' => false,
    'test_result' => 'FAIL — expected "Token, user ID, and new password are required" (HTTP 400)',
    'api_http_code' => $result['http_code'],
    'api_response' => $response,
    'api_raw' => $result['raw'],
]);
