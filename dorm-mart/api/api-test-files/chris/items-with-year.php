<?php
/**
 * Thin proxy to the canonical endpoint purchase-history/fetch-transacted-items.php.
 * POST JSON: { "year": 2024 } — same validation and response shape as production.
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

$year = (int) $input['year'];
$result = api_test_post_json('purchase-history/fetch-transacted-items.php', ['year' => $year]);

$code = $result['http_code'] > 0 ? $result['http_code'] : 502;
http_response_code($code);
echo $result['raw'] !== ''
    ? $result['raw']
    : json_encode(['success' => false, 'error' => 'Empty response from fetch-transacted-items']);
