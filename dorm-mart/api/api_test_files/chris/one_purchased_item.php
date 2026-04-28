<?php
/**
 * Data-dependent check: current calendar year should return exactly one legacy purchased_items row.
 * PASS only when the API reports success and count(data) === 1.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/bootstrap.php';

$year = (int) date('Y');
$result = api_test_post_json('purchase_history/fetch_transacted_items.php', ['year' => $year]);

$json = is_array($result['json']) ? $result['json'] : [];
$data = isset($json['data']) && is_array($json['data']) ? $json['data'] : [];
$n = count($data);
$apiOk = !empty($json['success']);
$pass = $apiOk && $n === 1;

echo json_encode([
    'success' => $pass,
    'year_queried' => $year,
    'item_count' => $n,
    'test_result' => $pass
        ? 'PASS — exactly one purchased item for current calendar year'
        : ($apiOk
            ? "FAIL — expected exactly one row for {$year}, got {$n} (data-dependent)"
            : 'FAIL — API did not return success'),
    'api_http_code' => $result['http_code'],
    'data' => $data,
    'api_response' => $json,
], JSON_UNESCAPED_UNICODE);
