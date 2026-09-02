<?php

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';

init_json_endpoint();

require_login();

$conn = db();

$input = json_request_body(); // read raw request body and decode JSON
$year  = isset($input['year']) ? intval($input['year']) : null; // coerce to integer if provided

$maxYear = (int) date('Y') + 1;
if ($year === null || $year < 2016 || $year > $maxYear) {
    json_response([
        'success' => false,                           // preserve response shape
        'error'   => 'Invalid or missing year'
    ], 400);
}

$start = sprintf('%04d-01-01 00:00:00', $year);       // start of the year (inclusive)
$end   = sprintf('%04d-01-01 00:00:00', $year + 1);   // start of next year (exclusive)

$sql = "SELECT item_id, title, sold_by, transacted_at, image_url
        FROM purchased_items
        WHERE transacted_at >= ? AND transacted_at < ?
        ORDER BY transacted_at DESC";

$stmt = $conn->prepare($sql);                         // prepare statement to avoid SQL injection
if (!$stmt) {
    json_response(['success' => false, 'error' => 'Failed to prepare query'], 500);
}

$stmt->bind_param('ss', $start, $end);                // bind date range params as strings
$stmt->execute();                                     // run the query
$res = $stmt->get_result();                           // fetch mysqli_result

$rows = [];
while ($row = $res->fetch_assoc()) {
    $rows[] = [
        'item_id' => (int)$row['item_id'],
        'title' => $row['title'],
        'sold_by' => $row['sold_by'],
        'transacted_at' => $row['transacted_at'],
        'image_url' => $row['image_url'] ?? ''
    ];
}

json_response(['success' => true, 'data' => $rows]);
