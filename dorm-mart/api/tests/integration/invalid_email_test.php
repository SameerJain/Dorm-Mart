<?php
/**
 * Integration test: forgot_password does NOT reveal whether a UB-formatted
 * email is registered. forgot_password.php deliberately returns the same
 * generic accepted-response (PASSWORD_RESET_ACCEPTED_MESSAGE, HTTP 202) for
 * both known and unknown emails, plus a padded response time, specifically
 * to prevent user-enumeration attacks — so an unregistered email must get
 * the identical response shape a registered one would, not a distinguishing
 * "not found" style error.
 *
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

function api_test_forgot_password_leaks_account_existence(string $error): bool
{
    if ($error === 'Email not found') {
        return true;
    }
    $lower = strtolower($error);
    return str_contains($lower, 'not found')
        || str_contains($lower, 'no account')
        || str_contains($lower, 'does not exist');
}

$err = isset($response['error']) ? (string) $response['error'] : '';
$leaksExistence = api_test_forgot_password_leaks_account_existence($err);

// The correct, secure behavior is the generic accepted response — identical
// to what a registered email gets — at HTTP 202.
$isGenericAccepted = $result['http_code'] === 202
    && !empty($response['success'])
    && $response['success'] === true;

if ($isGenericAccepted && !$leaksExistence) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'test_result' => 'PASS — API returned the same generic accepted response for an unregistered email (no user-enumeration leak)',
        'api_http_code' => $result['http_code'],
        'api_response' => $response,
    ]);
    exit;
}

http_response_code(200);
echo json_encode([
    'success' => false,
    'test_result' => $leaksExistence
        ? 'FAIL — SECURITY: API revealed that this email is not registered (user-enumeration leak): ' . $err
        : 'FAIL — expected the generic accepted response (HTTP 202, success:true) for an unregistered email',
    'api_http_code' => $result['http_code'],
    'api_response' => $response,
    'api_raw' => $result['raw'],
]);
