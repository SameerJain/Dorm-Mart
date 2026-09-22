<?php
/**
 * Calls the canonical purchase_history endpoint for a future calendar year.
 * Expects an empty list (no transactions dated in that year).
 *
 * fetch_transacted_items.php requires a logged-in session — without it this
 * would get a 401 and mislabel "not authenticated" as "no purchases".
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/bootstrap.php';

$futureYear = (int) date('Y') + 1;
$session = api_test_login_session();
if ($session === null) {
    echo json_encode([
        'success' => false,
        'test_result' => 'FAIL — API_TEST_LOGIN_EMAIL / API_TEST_LOGIN_PASSWORD are unset or login failed; this endpoint requires a logged-in session.',
    ]);
    exit;
}

$result = api_test_post_json('purchase_history/fetch_transacted_items.php', ['year' => $futureYear], $session['cookie_jar']);

$json = is_array($result['json']) ? $result['json'] : [];
$data = $json['data'] ?? null;
$isEmptyList = is_array($data) && count($data) === 0;
$success = !empty($json['success']) && $isEmptyList;

echo json_encode([
    'success' => $success,
    'year_queried' => $futureYear,
    'test_result' => $success
        ? 'PASS — fetch-transacted-items returned success with empty data for future year'
        : 'FAIL — expected success with empty data[] for a year with no transactions',
    'api_http_code' => $result['http_code'],
    'data' => is_array($data) ? $data : [],
    'api_response' => $json,
], JSON_UNESCAPED_UNICODE);
