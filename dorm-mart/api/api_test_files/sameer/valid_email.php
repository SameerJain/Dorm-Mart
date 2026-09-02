<?php
/**
 * Integration test: forgot_password accepts a real UB email and returns success when mail can be sent.
 *
 * Environment:
 *   - Set API_TEST_BASE_URL to your api root if needed (e.g. http://localhost/f25-no-brainers/dorm-mart/api).
 *   - Repeated runs may hit rate limiting (see forgot_password.php); that is not a validation failure.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/bootstrap.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input) || !isset($input['email'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email is required']);
    exit;
}

$email = (string) $input['email'];

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !str_ends_with($email, '@buffalo.edu')) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email must be a valid UB email address']);
    exit;
}

$result = api_test_post_json('auth/forgot_password.php', ['email' => $email]);
$response = is_array($result['json']) ? $result['json'] : [];
$err = isset($response['error']) ? (string) $response['error'] : '';

if (!empty($response['success']) && $response['success'] === true) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'test_result' => 'PASS — forgot_password returned success',
        'api_http_code' => $result['http_code'],
        'api_response' => $response,
    ]);
    exit;
}

$rateLimited = $err !== '' && (stripos($err, 'wait') !== false || stripos($err, 'minute') !== false);
if ($rateLimited) {
    http_response_code(200);
    echo json_encode([
        'success' => false,
        'inconclusive' => true,
        'test_result' => 'INCONCLUSIVE — rate limited; wait and retry (not an email-validation failure)',
        'api_http_code' => $result['http_code'],
        'api_response' => $response,
    ]);
    exit;
}

http_response_code(200);
echo json_encode([
    'success' => false,
    'test_result' => 'FAIL — expected success from forgot_password (check mail/SendGrid config)',
    'api_http_code' => $result['http_code'],
    'api_response' => $response,
    'api_raw' => $result['raw'],
]);
