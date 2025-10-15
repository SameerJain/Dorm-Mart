<?php
header('Content-Type: application/json');

require_once __DIR__ . '/auth/utility/has_auth.php';
require_once __DIR__ . '/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];

// Ensure user is authenticated
$userId = has_auth();
$conn = db();

// Helpers
function getPrefs(mysqli $conn, int $userId) {
  $stmt = $conn->prepare('SELECT promo_emails, reveal_contact, interests, theme FROM user_preferences WHERE user_id = ?');
  $stmt->bind_param('i', $userId);
  $stmt->execute();
  $res = $stmt->get_result();
  $row = $res->fetch_assoc();
  $stmt->close();
  if (!$row) {
    return [
      'promoEmails' => false,
      'revealContact' => false,
      'interests' => [],
      'theme' => 'light',
    ];
  }
  return [
    'promoEmails' => (bool)$row['promo_emails'],
    'revealContact' => (bool)$row['reveal_contact'],
    'interests' => $row['interests'] ? json_decode($row['interests'], true) : [],
    'theme' => ($row['theme'] === 'dark' ? 'dark' : 'light'),
  ];
}

try {
  if ($method === 'GET') {
    $data = getPrefs($conn, $userId);
    echo json_encode(['ok' => true, 'data' => $data]);
    $conn->close();
    exit;
  }

  if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true);
    if (!is_array($body)) $body = [];

  $promo = isset($body['promoEmails']) ? (int)!!$body['promoEmails'] : 0;
  $reveal = isset($body['revealContact']) ? (int)!!$body['revealContact'] : 0;
    $interests = isset($body['interests']) && is_array($body['interests']) ? $body['interests'] : [];
    $theme = (isset($body['theme']) && $body['theme'] === 'dark') ? 'dark' : 'light';

    // upsert
    $json = json_encode(array_values(array_unique(array_map('strval', $interests))));

    $stmt = $conn->prepare('INSERT INTO user_preferences (user_id, promo_emails, reveal_contact, interests, theme)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE promo_emails = VALUES(promo_emails), reveal_contact = VALUES(reveal_contact), interests = VALUES(interests), theme = VALUES(theme)');
    $stmt->bind_param('iiiss', $userId, $promo, $reveal, $json, $theme);
    $stmt->execute();
    $stmt->close();

    echo json_encode(['ok' => true]);
    $conn->close();
    exit;
  }

  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Method Not Allowed']);
  $conn->close();
  exit;
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Server error']);
  if (isset($conn)) $conn->close();
  exit;
}
