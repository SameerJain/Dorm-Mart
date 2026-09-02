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
  $stmt = $conn->prepare('SELECT theme, promotional, promo_frequency, reveal_contact_info, phone_number, interested_category_1, interested_category_2, interested_category_3 FROM user_accounts WHERE user_id = ?');
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
  
  $revealContact = false; // default
  if ($userRow && isset($userRow['reveal_contact_info'])) {
    $revealContact = (bool)$userRow['reveal_contact_info'];
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
  
  $result = [
    'promoEmails' => $promoEmails,
    'promoFrequency' => $userRow['promo_frequency'] ?? ($promoEmails ? 'weekly' : 'off'),
    'revealContact' => $revealContact,
    'contactPhone' => $userRow['phone_number'] ?? '',
    'interests' => $interests,
    'theme' => $theme,
  ];
  
  return $result;
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

    $frequency = $body['promoFrequency'] ?? 'off';
    if (!is_string($frequency) || !in_array($frequency, ['off', 'daily', 'weekly'], true)) {
      json_response(['ok' => false, 'error' => 'Invalid promotional email frequency'], 400);
    }
    $promo = $frequency === 'off' ? 0 : 1;
    $revealValue = strict_boolean_value($body['revealContact'] ?? false);
    if ($revealValue === null) {
      json_response(['ok' => false, 'error' => 'Invalid contact visibility setting'], 400);
    }
    $reveal = $revealValue ? 1 : 0;
    $phoneValue = $body['contactPhone'] ?? '';
    if (!is_string($phoneValue)) {
      json_response(['ok' => false, 'error' => 'Invalid phone number'], 400);
    }
    $phone = trim($phoneValue);
    if ($phone !== '' && (!preg_match('/^[0-9+().\-\s]{1,25}$/', $phone) || !preg_match('/\d/', $phone))) {
      json_response(['ok' => false, 'error' => 'Invalid phone number'], 400);
    }
    $phone = $phone !== '' ? $phone : null;
    $allowedCategories = allowed_preference_categories();
    $interestsValue = $body['interests'] ?? [];
    if (!is_array($interestsValue) || count($interestsValue) > 3
        || array_filter($interestsValue, fn($category) => !is_string($category) || !in_array($category, $allowedCategories, true))) {
      json_response(['ok' => false, 'error' => 'Invalid interest categories'], 400);
    }
    $interests = array_values(array_unique($interestsValue));
    $themeValue = $body['theme'] ?? 'light';
    if (!is_string($themeValue) || !in_array($themeValue, ['light', 'dark'], true)) {
      json_response(['ok' => false, 'error' => 'Invalid theme'], 400);
    }
    $theme = $themeValue === 'dark' ? 1 : 0;
    
    // Prepare the 3 category values
    $int1 = $interests[0] ?? null;
    $int2 = $interests[1] ?? null;
    $int3 = $interests[2] ?? null;

    // Check if user is opting into promo emails for the first time
    $shouldSendEmail = false;
    if ($promo) {
      // Check if user has never received the intro promo email
      $stmt = $conn->prepare('SELECT received_intro_promo_email FROM user_accounts WHERE user_id = ?');
      $stmt->bind_param('i', $userId);
      $stmt->execute();
      $res = $stmt->get_result();
      $userRow = $res->fetch_assoc();
      $stmt->close();
      
      // Debug logging
      if ($userRow && !$userRow['received_intro_promo_email']) {
        $shouldSendEmail = true;
      }
      error_log("user_preferences: promo opt-in requested; intro email " . ($shouldSendEmail ? "will be sent" : "already sent or unavailable") . " for user_id {$userId}");
    } else {
      error_log("user_preferences: promo emails disabled for user_id {$userId}; no promo email will be sent");
    }

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $stmt = $conn->prepare('UPDATE user_accounts SET theme = ?, promotional = ?, promo_frequency = ?, reveal_contact_info = ?, phone_number = ?, interested_category_1 = ?, interested_category_2 = ?, interested_category_3 = ? WHERE user_id = ?');
    $stmt->bind_param('iisissssi', $theme, $promo, $frequency, $reveal, $phone, $int1, $int2, $int3, $userId);
    $result = $stmt->execute();
    if (!$result) {
      error_log("Failed to update user_accounts: " . $stmt->error);
    }
    $stmt->close();

    // Send promo welcome email if this is the first time opting in
    if ($shouldSendEmail) {
      // Get user details for email
      $stmt = $conn->prepare('SELECT first_name, last_name, email FROM user_accounts WHERE user_id = ?');
      $stmt->bind_param('i', $userId);
      $stmt->execute();
      $res = $stmt->get_result();
      $userDetails = $res->fetch_assoc();
      $stmt->close();
      
      if ($userDetails) {
        error_log("user_preferences: attempting promo welcome email for user_id {$userId}");
        $emailResult = send_promo_welcome_email([
          'firstName' => $userDetails['first_name'],
          'lastName' => $userDetails['last_name'],
          'email' => $userDetails['email']
        ]);

        if (!$emailResult['ok']) {
          error_log("Failed to send promo welcome email: " . $emailResult['error']);
        } else {
          $stmt2 = $conn->prepare('UPDATE user_accounts SET received_intro_promo_email = 1 WHERE user_id = ?');
          $stmt2->bind_param('i', $userId);
          $stmt2->execute();
          $stmt2->close();
          error_log("user_preferences: promo welcome email send completed for user_id {$userId}");
        }
      } else {
        error_log("user_preferences: could not load user details for promo email, user_id {$userId}");
      }
    }

    $conn->close();
    json_response(['ok' => true]);
  }

  $conn->close();
  json_response(['ok' => false, 'error' => 'Method Not Allowed'], 405);
} catch (Throwable $e) {
  if (isset($conn)) $conn->close();
  json_response(['ok' => false, 'error' => 'Server error'], 500);
}
