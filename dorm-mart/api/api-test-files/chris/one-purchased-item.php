<?php
// __DIR__ points to api/
require __DIR__ . '/../../db_connect.php';

$conn = db();

$sql_clean_data = "TRUNCATE TABLE transacted_items";
$conn->query($sql_clean_data);

$sql_insert_item = "
INSERT INTO transacted_items
  (title, sold_by, transacted_at, buyer_user_id, seller_user_id, image_url)
VALUES
  ('Wireless Mouse', 'Sameer Jain', NOW(), 1, 2, 'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fmytarget.my%2Fwp-content%2Fuploads%2F2021%2F01%2FLOGITECH-WIRELESS-MOUSE-M185-BLUE-2048x2048.jpg&f=1&nofb=1&ipt=522298799c48978a253f330e6e16be5c273a856e85e6e2e45f3dd22ef7ec2956')
";

$conn->query($sql_insert_item);

$sql = "SELECT *
        FROM transacted_items
        ORDER BY transacted_at DESC";

$res = $conn->query($sql);

$rows = [];
while ($row = $res->fetch_assoc()) {
    $rows[] = $row;
}

echo json_encode(['success' => true, 'data' => $rows]);

