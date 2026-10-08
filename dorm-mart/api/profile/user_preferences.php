<?php
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/promo_email.php';

init_json_endpoint();

$method = $_SERVER['REQUEST_METHOD'];

// Ensure user is authenticated
$userId = require_login();
$conn = db();

// Helpers
function get_prefs(mysqli $conn, int $userId)
{
  // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
  $stmt = $conn->prepare('SELECT theme, promotional, promo_frequency, interested_category_1, interested_category_2, interested_category_3 FROM user_accounts WHERE user_id = ?');
  $stmt->bind_param('i', $userId);  // 'i' = integer type, safely bound as parameter
  $stmt->execute();
  $res = $stmt->get_result();
  $userRow = $res->fetch_assoc();
  $stmt->close();

  $theme = 'light'; // default
  if ($userRow && array_key_exists('theme', $userRow) && $userRow['theme'] !== null) {
    $theme = $userRow['theme'] ? 'dark' : 'light';
  }

  $promoEmails = false; // default
  if ($userRow && isset($userRow['promotional'])) {
    $promoEmails = (bool)$userRow['promotional'];
  }

  // Build interests array from the 3 category columns
  $interests = [];
  if ($userRow) {
    $rawInterests = array_filter([
      $userRow['interested_category_1'] ?? null,
      $userRow['interested_category_2'] ?? null,
      $userRow['interested_category_3'] ?? null
    ]);
    foreach ($rawInterests as $interest) {
      if ($interest !== null && $interest !== '') {
        $interests[] = (string)$interest;
      }
    }
  }

  return [
    'promoEmails' => $promoEmails,
    'promoFrequency' => $userRow['promo_frequency'] ?? ($promoEmails ? 'weekly' : 'off'),
    'interests' => $interests,
    'theme' => $theme,
  ];
}

function allowed_preference_categories(): array
{
  $path = __DIR__ . '/../categories/categories.json';
  $contents = is_readable($path) ? file_get_contents($path) : false;
  $categories = $contents !== false ? json_decode($contents, true) : null;
  if (!is_array($categories)) {
    throw new RuntimeException('Unable to load preference categories');
  }

  return array_values(array_filter($categories, fn($category) => is_string($category) && $category !== ''));
}

try {
  if ($method === 'GET') {
    $data = get_prefs($conn, $userId);
    $conn->close();
    json_response(['ok' => true, 'data' => $data]);
  }

  if ($method === 'POST') {
    $body = json_request_body();
    require_csrf_token($body['csrf_token'] ?? null);

    // Partial update: only keys present in the request are validated and written.
    // The theme toggle sends a single field; treating the missing ones as
    // "off"/empty used to wipe the rest of the user's settings.
    $sets = [];
    $types = '';
    $values = [];
    $promoTurnedOn = false;

    if (array_key_exists('promoFrequency', $body)) {
      $frequency = $body['promoFrequency'];
      if (!is_string($frequency) || !in_array($frequency, ['off', 'daily', 'weekly'], true)) {
        json_response(['ok' => false, 'error' => 'Invalid promotional email frequency'], 400);
      }
      $promo = $frequency === 'off' ? 0 : 1;
      $sets[] = 'promotional = ?';
      $types .= 'i';
      $values[] = $promo;
      $sets[] = 'promo_frequency = ?';
      $types .= 's';
      $values[] = $frequency;
      $promoTurnedOn = $promo === 1;
    }

    if (array_key_exists('interests', $body)) {
      $allowedCategories = allowed_preference_categories();
      $interestsValue = $body['interests'];
      if (!is_array($interestsValue) || count($interestsValue) > 3
          || array_filter($interestsValue, fn($category) => !is_string($category) || !in_array($category, $allowedCategories, true))) {
        json_response(['ok' => false, 'error' => 'Invalid interest categories'], 400);
      }
      $interests = array_values(array_unique($interestsValue));
      foreach (['interested_category_1', 'interested_category_2', 'interested_category_3'] as $i => $column) {
        $sets[] = "{$column} = ?";
        $types .= 's';
        $values[] = $interests[$i] ?? null;
      }
    }

    if (array_key_exists('theme', $body)) {
      $themeValue = $body['theme'];
      if (!is_string($themeValue) || !in_array($themeValue, ['light', 'dark'], true)) {
        json_response(['ok' => false, 'error' => 'Invalid theme'], 400);
      }
      $sets[] = 'theme = ?';
      $types .= 'i';
      $values[] = $themeValue === 'dark' ? 1 : 0;
    }

    if ($sets === []) {
      json_response(['ok' => false, 'error' => 'No preferences to update'], 400);
    }

    // Send the intro email only when promos go from off to on and it was never sent.
    $shouldSendEmail = false;
    if ($promoTurnedOn) {
      $stmt = $conn->prepare('SELECT promotional, received_intro_promo_email FROM user_accounts WHERE user_id = ?');
      $stmt->bind_param('i', $userId);
      $stmt->execute();
      $previous = $stmt->get_result()->fetch_assoc();
      $stmt->close();
      $shouldSendEmail = $previous
        && (int)$previous['promotional'] === 0
        && !(int)$previous['received_intro_promo_email'];
    }

    // SQL INJECTION PROTECTION: column names come from the fixed list above;
    // every value is bound as a parameter.
    $stmt = $conn->prepare('UPDATE user_accounts SET ' . implode(', ', $sets) . ' WHERE user_id = ?');
    if (!$stmt) {
      throw new RuntimeException('Failed to prepare preferences update');
    }
    $types .= 'i';
    $values[] = $userId;
    $stmt->bind_param($types, ...$values);
    if (!$stmt->execute()) {
      error_log('user_preferences: update failed: ' . $stmt->error);
      $stmt->close();
      $conn->close();
      json_response(['ok' => false, 'error' => 'Unable to save preferences.'], 500);
    }
    $stmt->close();

    if ($shouldSendEmail) {
      $stmt = $conn->prepare('SELECT first_name, last_name, email FROM user_accounts WHERE user_id = ?');
      $stmt->bind_param('i', $userId);
      $stmt->execute();
      $userDetails = $stmt->get_result()->fetch_assoc();
      $stmt->close();

      if ($userDetails) {
        $emailResult = send_promo_welcome_email([
          'firstName' => $userDetails['first_name'],
          'lastName' => $userDetails['last_name'],
          'email' => $userDetails['email']
        ]);

        if (!$emailResult['ok']) {
          error_log("user_preferences: promo welcome email failed for user_id {$userId}: " . $emailResult['error']);
        } else {
          $stmt2 = $conn->prepare('UPDATE user_accounts SET received_intro_promo_email = 1 WHERE user_id = ?');
          $stmt2->bind_param('i', $userId);
          $stmt2->execute();
          $stmt2->close();
        }
      }
    }

    $data = get_prefs($conn, $userId);
    $conn->close();
    json_response(['ok' => true, 'data' => $data]);
  }

  $conn->close();
  json_response(['ok' => false, 'error' => 'Method Not Allowed'], 405);
} catch (Throwable $e) {
  error_log('user_preferences: ' . $e->getMessage());
  if (isset($conn)) $conn->close();
  json_response(['ok' => false, 'error' => 'Server error'], 500);
}
