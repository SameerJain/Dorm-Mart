<?php
// __DIR__ points to api/
require __DIR__ . '/db_connect.php';

$conn = db();

$sql = "SELECT id, title, sold_by, transacted_at, image_url
        FROM transacted_items
        ORDER BY transacted_at DESC";

$res = $conn->query($sql);

$rows = [];
while ($row = $res->fetch_assoc()) {
    $rows[] = $row;
}

echo json_encode(['success' => true, 'data' => $rows]);

