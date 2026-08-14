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
  $stmt = $conn->prepare('SELECT theme, promotional, promo_frequency, reveal_contact_info, interested_category_1, interested_category_2, interested_category_3 FROM user_accounts WHERE user_id = ?');
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
    'interests' => $interests,
    'theme' => $theme,
  ];
  
  return $result;
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

    $frequency = in_array(($body['promoFrequency'] ?? 'off'), ['off', 'daily', 'weekly'], true) ? $body['promoFrequency'] : 'off';
    $promo = $frequency === 'off' ? 0 : 1;
    $reveal = isset($body['revealContact']) ? (int)!!$body['revealContact'] : 0;
    $ALLOWED_CATS = ['Textbooks', 'Electronics', 'Clothing', 'Furniture', 'Food', 'Services', 'Other'];
    $interests = isset($body['interests']) && is_array($body['interests'])
        ? array_slice(array_values(array_filter($body['interests'], fn($c) => in_array($c, $ALLOWED_CATS, true))), 0, 3)
        : [];
    $theme = (isset($body['theme']) && $body['theme'] === 'dark') ? 1 : 0;
    
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
    $stmt = $conn->prepare('UPDATE user_accounts SET theme = ?, promotional = ?, promo_frequency = ?, reveal_contact_info = ?, interested_category_1 = ?, interested_category_2 = ?, interested_category_3 = ? WHERE user_id = ?');
    $stmt->bind_param('iisisssi', $theme, $promo, $frequency, $reveal, $int1, $int2, $int3, $userId);
    $result = $stmt->execute();
    if (!$result) {
      error_log("Failed to update user_accounts: " . $stmt->error);
    }
    $stmt->close();

    // Handle received_intro_promo_email separately if needed
    if ($shouldSendEmail) {
      $stmt2 = $conn->prepare('UPDATE user_accounts SET received_intro_promo_email = 1 WHERE user_id = ?');
      $stmt2->bind_param('i', $userId);
      $stmt2->execute();
      $stmt2->close();
    }

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
