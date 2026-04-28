<?php
/**
 * Calls the canonical purchase_history endpoint for a future calendar year.
 * Expects an empty list (no transactions dated in that year).
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/bootstrap.php';

$futureYear = (int) date('Y') + 1;
$result = api_test_post_json('purchase_history/fetch_transacted_items.php', ['year' => $futureYear]);

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
