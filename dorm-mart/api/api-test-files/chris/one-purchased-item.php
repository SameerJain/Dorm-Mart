<?php
// __DIR__ points to api/
require __DIR__ . '/../../db_connect.php';

$conn = db();

$sql = "SELECT *
        FROM purchased_items
        ORDER BY transacted_at DESC
        LIMIT 1
";

$res = $conn->query($sql);

$rows = [];
while ($row = $res->fetch_assoc()) {
    $rows[] = $row;
}

echo json_encode(['success' => true, 'data' => $rows]);

