<?php
/**
 * Data-dependent check: current calendar year should return at least two legacy rows.
 *
 * fetch_transacted_items.php requires a logged-in session, and the rows this
 * checks for belong to whichever account API_TEST_LOGIN_EMAIL logs in as —
 * set it to the seeded account those rows actually belong to, or this will
 * correctly report a data-dependent FAIL (0 rows) for an unrelated account.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/bootstrap.php';

$year = (int) date('Y');
$session = api_test_login_session();
if ($session === null) {
    echo json_encode([
        'success' => false,
        'test_result' => 'FAIL — API_TEST_LOGIN_EMAIL / API_TEST_LOGIN_PASSWORD are unset or login failed; this endpoint requires a logged-in session.',
    ]);
    exit;
}

$result = api_test_post_json('purchase_history/fetch_transacted_items.php', ['year' => $year], $session['cookie_jar']);

$json = is_array($result['json']) ? $result['json'] : [];
$data = isset($json['data']) && is_array($json['data']) ? $json['data'] : [];
$n = count($data);
$apiOk = !empty($json['success']);
$pass = $apiOk && $n >= 2;

echo json_encode([
    'success' => $pass,
    'year_queried' => $year,
    'item_count' => $n,
    'test_result' => $pass
        ? 'PASS — at least two purchased items for current calendar year'
        : ($apiOk
            ? "FAIL — expected at least two rows for {$year}, got {$n} (data-dependent)"
            : 'FAIL — API did not return success'),
    'api_http_code' => $result['http_code'],
    'data' => $data,
    'api_response' => $json,
], JSON_UNESCAPED_UNICODE);
