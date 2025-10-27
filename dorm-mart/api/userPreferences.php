<?php
header('Content-Type: application/json');

// Include security utilities
require_once __DIR__ . '/security/security.php';
setSecurityHeaders();
setSecureCORS();

require_once __DIR__ . '/auth/auth_handle.php';
require_once __DIR__ . '/database/db_connect.php';

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

// Ensure user is authenticated
$userId = require_login();
$conn = db();

// Helpers
function getPrefs(mysqli $conn, int $userId)
{
  // Get theme from user_accounts table
  $stmt = $conn->prepare('SELECT theme FROM user_accounts WHERE user_id = ?');
  $stmt->bind_param('i', $userId);
  $stmt->execute();
  $res = $stmt->get_result();
  $userRow = $res->fetch_assoc();
  $stmt->close();
  
  $theme = 'light'; // default
  if ($userRow && isset($userRow['theme'])) {
    $theme = $userRow['theme'] ? 'dark' : 'light';
  }
  
  // Get other preferences from user_preferences table
  $stmt = $conn->prepare('SELECT promo_emails, reveal_contact, interests FROM user_preferences WHERE user_id = ?');
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
      'theme' => $theme,
    ];
  }
  return [
    'promoEmails' => (bool)$row['promo_emails'],
    'revealContact' => (bool)$row['reveal_contact'],
    'interests' => $row['interests'] ? json_decode($row['interests'], true) : [],
    'theme' => $theme,
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
    $theme = (isset($body['theme']) && $body['theme'] === 'dark') ? 1 : 0;

    // Save theme to user_accounts table
    $stmt = $conn->prepare('UPDATE user_accounts SET theme = ? WHERE user_id = ?');
    $stmt->bind_param('ii', $theme, $userId);
    $stmt->execute();
    $stmt->close();

    // Save other preferences to user_preferences table
    $json = json_encode(array_values(array_unique(array_map('strval', $interests))));

    $stmt = $conn->prepare('INSERT INTO user_preferences (user_id, promo_emails, reveal_contact, interests)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE promo_emails = VALUES(promo_emails), reveal_contact = VALUES(reveal_contact), interests = VALUES(interests)');
    $stmt->bind_param('iiis', $userId, $promo, $reveal, $json);
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
