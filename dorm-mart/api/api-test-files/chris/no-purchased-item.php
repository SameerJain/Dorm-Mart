<?php
// __DIR__ points to api/
require __DIR__ . '/../../database/db_connect.php';

$conn = db();

$rows = [];

echo json_encode(['success' => true, 'data' => $rows]);
