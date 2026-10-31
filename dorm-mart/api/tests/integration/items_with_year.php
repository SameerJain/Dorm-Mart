<?php
/**
 * Thin proxy to the canonical endpoint purchase_history/fetch_transacted_items.php.
 * POST JSON: { "year": 2024 } — same validation and response shape as production.
 *
 * fetch_transacted_items.php requires a logged-in session, which this proxy
 * does not inherit from its own caller (it makes a fresh outbound request).
 * Set API_TEST_LOGIN_EMAIL / API_TEST_LOGIN_PASSWORD or every call here just
 * relays a 401 "Not authenticated", not the endpoint's real behavior.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input) || !isset($input['year'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'JSON body must include year']);
    exit;
}

$session = api_test_login_session();
if ($session === null) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'API_TEST_LOGIN_EMAIL / API_TEST_LOGIN_PASSWORD are unset or login failed — this endpoint requires a logged-in session.']);
    exit;
}

$year = (int) $input['year'];
$result = api_test_post_json('purchase_history/fetch_transacted_items.php', ['year' => $year], $session['cookie_jar']);

$code = $result['http_code'] > 0 ? $result['http_code'] : 502;
http_response_code($code);
echo $result['raw'] !== ''
    ? $result['raw']
    : json_encode(['success' => false, 'error' => 'Empty response from fetch-transacted-items']);
