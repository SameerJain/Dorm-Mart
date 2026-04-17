<?php
/**
 * Replaces the old "passwords do not match" test: this API has a single newPassword field.
 * Integration test: missing token or newPassword returns 400 from reset-password.php.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/bootstrap.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = [];
}

// Default case: empty body → API should require both fields
$postBody = $input;
if ($postBody === []) {
    $postBody = ['token' => '', 'newPassword' => ''];
}

$result = api_test_post_json('auth/reset-password.php', $postBody);

$response = is_array($result['json']) ? $result['json'] : [];
$error = isset($response['error']) ? (string) $response['error'] : '';

$missingFields = $result['http_code'] === 400
    && $error === 'Token and new password are required';

if ($missingFields) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'test_result' => 'PASS — API requires token and newPassword',
        'api_http_code' => $result['http_code'],
        'api_response' => $response,
    ]);
    exit;
}

http_response_code(200);
echo json_encode([
    'success' => false,
    'test_result' => 'FAIL — expected "Token and new password are required" (HTTP 400)',
    'api_http_code' => $result['http_code'],
    'api_response' => $response,
    'api_raw' => $result['raw'],
]);
