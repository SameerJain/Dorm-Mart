<?php
/**
 * Integration test: forgot_password returns a clear error for a UB-formatted email that is not registered.
 *
 * Accepts several common error wordings (exact "Email not found" or similar).
 * Set API_TEST_BASE_URL when not running under the web server (see bootstrap.php).
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

function api_test_forgot_password_not_found_error(string $error): bool
{
    if ($error === 'Email not found') {
        return true;
    }
    $lower = strtolower($error);
    if (str_contains($lower, 'not found')) {
        return true;
    }
    if (str_contains($lower, 'no account')) {
        return true;
    }
    if (str_contains($lower, 'does not exist')) {
        return true;
    }

    return false;
}

if (api_test_forgot_password_not_found_error($err)) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'test_result' => 'PASS — API indicated unknown / unregistered email',
        'api_http_code' => $result['http_code'],
        'api_response' => $response,
    ]);
    exit;
}

http_response_code(200);
echo json_encode([
    'success' => false,
    'test_result' => 'FAIL — expected a not-found style error for unknown UB email',
    'api_http_code' => $result['http_code'],
    'api_response' => $response,
    'api_raw' => $result['raw'],
]);
