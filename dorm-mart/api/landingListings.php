<?php
header('Content-Type: application/json');

// Include security utilities
require_once __DIR__ . '/security/security.php';
setSecurityHeaders();
setSecureCORS();

require_once __DIR__ . '/database/db_connect.php';

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
  $conn = db();

  // Detect a likely listings table; fall back to static sample if absent.
  $sql = null;
  if ($res = $conn->query("SHOW TABLES LIKE 'product_listings'")) {
    if ($res->num_rows > 0) {
      $sql = "SELECT id, title, price, image_url AS image, seller_name AS seller, rating, location, created_at, status, tags FROM product_listings WHERE (status IS NULL OR status <> 'sold') ORDER BY created_at DESC LIMIT 9";
    }
    $res->close();
  }
  if (!$sql) {
    if ($res2 = $conn->query("SHOW TABLES LIKE 'items'")) {
      if ($res2->num_rows > 0) {
        $sql = "SELECT id, name AS title, price, image AS image, seller AS seller, rating, location, created_at, status, tags FROM items ORDER BY created_at DESC LIMIT 9";
      }
      $res2->close();
    }
  }

  $rows = [];
  if ($sql) {
    if ($q = $conn->query($sql)) {
      while ($row = $q->fetch_assoc()) {
        $rows[] = [
          'id' => isset($row['id']) ? (int)$row['id'] : null,
          'title' => escapeHtml($row['title'] ?? ($row['name'] ?? 'Untitled')),
          'price' => isset($row['price']) && is_numeric($row['price']) ? (float)$row['price'] : null,
          'image' => escapeHtml($row['image'] ?? ($row['image_url'] ?? '')),
          'seller' => escapeHtml($row['seller'] ?? ($row['seller_name'] ?? 'Unknown Seller')),
          'rating' => (isset($row['rating']) && is_numeric($row['rating'])) ? (float)$row['rating'] : 4.7,
          'location' => escapeHtml($row['location'] ?? 'North Campus'),
          'created_at' => $row['created_at'] ?? null,
          'status' => escapeHtml($row['status'] ?? ''),
          'tags' => escapeHtml($row['tags'] ?? ''),
        ];
      }
      $q->close();
    }
  }

  if (!count($rows)) {
    // Static sample fallback; frontend also has its own fallback.
    $rows = [
      ['id' => 1001, 'title' => 'Sample Lamp', 'price' => 15, 'image' => null, 'seller' => 'Sample Seller', 'rating' => 4.9, 'location' => 'North Campus', 'created_at' => null, 'status' => 'AVAILABLE', 'tags' => 'Decor,Lighting'],
      ['id' => 1002, 'title' => 'Sample Textbook', 'price' => 55, 'image' => null, 'seller' => 'Book Vendor', 'rating' => 4.8, 'location' => 'Ellicott', 'created_at' => null, 'status' => 'JUST POSTED', 'tags' => 'Books,Education'],
    ];
  }

  echo json_encode($rows);
  $conn->close();
  exit;
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['error' => 'Server error']);
  if (isset($conn) && $conn instanceof mysqli) $conn->close();
  exit;
}
