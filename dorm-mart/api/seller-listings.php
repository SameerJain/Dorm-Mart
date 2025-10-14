<?php
header('Content-Type: application/json');

// Simple test data for frontend
$data = [
    ['id' => 1, 'title' => 'Test Item', 'status' => 'active', 'buyer_user_id' => null],
    ['id' => 2, 'title' => 'Sold Item', 'status' => 'sold', 'buyer_user_id' => 2]
];

echo json_encode(['success' => true, 'data' => $data]);
?>
