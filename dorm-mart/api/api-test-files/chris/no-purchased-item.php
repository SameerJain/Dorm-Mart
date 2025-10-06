<?php
// __DIR__ points to api/
require __DIR__ . '/../../db_connect.php';

$conn = db();

$sql_clean_data = "TRUNCATE TABLE transacted_items";
$conn->query($sql_clean_data);

$sql = "SELECT *
        FROM transacted_items
        ORDER BY transacted_at DESC";

$res = $conn->query($sql);

$rows = [];
while ($row = $res->fetch_assoc()) {
    $rows[] = $row;
}

echo json_encode(['success' => true, 'data' => $rows]);

