<?php
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../utility/transactional_email_html.php';
require_once __DIR__ . '/../config/app_config.php';

// Include PHPMailer for promo email functionality
$PROJECT_ROOT = dirname(__DIR__, 2);
if (file_exists($PROJECT_ROOT . '/vendor/autoload.php')) {
    require $PROJECT_ROOT . '/vendor/autoload.php';
} else {
    require $PROJECT_ROOT . '/vendor/phpmailer/phpmailer/src/PHPMailer.php';
    require $PROJECT_ROOT . '/vendor/phpmailer/phpmailer/src/SMTP.php';
    require $PROJECT_ROOT . '/vendor/phpmailer/phpmailer/src/Exception.php';
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

init_json_endpoint();

$method = $_SERVER['REQUEST_METHOD'];

// Ensure user is authenticated
$userId = require_login();
$conn = db();

// Helpers
function getPrefs(mysqli $conn, int $userId)
{
  // ============================================================================
  // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
  // ============================================================================
  // Using prepared statement with '?' placeholder and bind_param() to safely
  // handle $userId. Even if malicious SQL is in $userId, it cannot execute
  // because it's bound as an integer parameter, not concatenated into SQL.
  // ============================================================================
  $stmt = $conn->prepare('SELECT theme, promotional, reveal_contact_info, interested_category_1, interested_category_2, interested_category_3 FROM user_accounts WHERE user_id = ?');
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
    'revealContact' => $revealContact,
    'interests' => $interests,
    'theme' => $theme,
  ];
  
  return $result;
}

/**
 * Send promo welcome email via SendGrid REST API (for Railway)
 */
function sendPromoWelcomeEmailViaSendGrid(array $user, string $apiKey): array
{
    global $PROJECT_ROOT;
    
    // Load SendGrid SDK
    if (file_exists($PROJECT_ROOT . '/vendor/autoload.php')) {
        require_once $PROJECT_ROOT . '/vendor/autoload.php';
    } else {
        error_log("SendGrid: vendor/autoload.php not found");
        return ['ok' => false, 'error' => 'SendGrid SDK not available'];
    }
    
    try {
        $sendgrid = new \SendGrid($apiKey);
        
        $pkg = dm_transactional_promo_welcome_package($user['firstName'] ?? '');
        $subject = $pkg['subject'];
        $html = $pkg['html'];
        $text = $pkg['text'];

        $fromEmail = dm_mail_from_email();
        if ($fromEmail === '') {
            error_log("SendGrid promo email failed: MAIL_FROM_EMAIL or GMAIL_USERNAME is not set");
            return ['ok' => false, 'error' => 'Email configuration missing'];
        }

        $email = new \SendGrid\Mail\Mail();
        $email->setFrom($fromEmail, dm_mail_from_name());
        $email->setSubject($subject);
        $email->addTo($user['email'], trim(($user['firstName'] ?? '') . ' ' . ($user['lastName'] ?? '')));
        $email->addContent("text/html", $html);
        $email->addContent("text/plain", $text);
        
        $response = $sendgrid->send($email);
        
        if ($response->statusCode() >= 200 && $response->statusCode() < 300) {
            return ['ok' => true, 'error' => null];
        } else {
            $errorBody = $response->body();
            error_log("SendGrid error in promo email: " . $response->statusCode() . " - " . $errorBody);
            return ['ok' => false, 'error' => 'Failed to send promo email via SendGrid'];
        }
    } catch (Exception $e) {
        error_log("SendGrid exception in sendPromoWelcomeEmailViaSendGrid: " . $e->getMessage());
        return ['ok' => false, 'error' => $e->getMessage()];
    }
}

function sendPromoWelcomeEmail(array $user): array
{
    // Check for SendGrid API key first (Railway option)
    $sendgridApiKey = getenv('SENDGRID_API_KEY');
    if (!empty($sendgridApiKey)) {
        // Use SendGrid REST API for Railway
        return sendPromoWelcomeEmailViaSendGrid($user, $sendgridApiKey);
    }

    // Ensure PHP is using UTF-8 internally
    if (function_exists('mb_internal_encoding')) {
        @mb_internal_encoding('UTF-8');
    }

    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = dm_smtp_host();
        $mail->SMTPAuth   = true;
        $mail->Username   = getenv('GMAIL_USERNAME');
        $mail->Password   = getenv('GMAIL_PASSWORD');
        $secure = dm_smtp_secure();
        $mail->SMTPSecure = $secure === 'smtps' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = dm_smtp_port();

        // Optimizations for faster email delivery
        $mail->Timeout = dm_smtp_timeout();
        $mail->SMTPKeepAlive = false;
        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ];

        // Tell PHPMailer we are sending UTF-8
        $mail->CharSet   = 'UTF-8';
        $mail->Encoding  = 'base64';

        // From/To
        $mail->setFrom(dm_mail_from_email(), dm_mail_from_name());
        $mail->addReplyTo(dm_mail_reply_to_email(), dm_mail_reply_to_name());
        $mail->addAddress($user['email'], trim(($user['firstName'] ?? '') . ' ' . ($user['lastName'] ?? '')));

        $pkg = dm_transactional_promo_welcome_package($user['firstName'] ?? '');
        $subject = $pkg['subject'];
        $html = $pkg['html'];
        $text = $pkg['text'];

        $mail->Subject = $subject;
        $mail->isHTML(true);
        $mail->Body    = $html;
        $mail->AltBody = $text;

        $mail->send();
        return ['ok' => true, 'error' => null];
    } catch (Exception $e) {
        return ['ok' => false, 'error' => $mail->ErrorInfo];
    }
}

try {
  if ($method === 'GET') {
    $data = getPrefs($conn, $userId);
    $conn->close();
    json_response(['ok' => true, 'data' => $data]);
  }

  if ($method === 'POST') {
    $body = json_request_body();

    /* Conditional CSRF validation - only validate if token is provided */
    $token = $body['csrf_token'] ?? null;
    if ($token !== null && !validate_csrf_token($token)) {
        json_response(['ok' => false, 'error' => 'CSRF token validation failed'], 403);
    }

    $promo = isset($body['promoEmails']) ? (int)!!$body['promoEmails'] : 0;
    $reveal = isset($body['revealContact']) ? (int)!!$body['revealContact'] : 0;
    $interests = isset($body['interests']) && is_array($body['interests']) ? array_slice($body['interests'], 0, 3) : [];
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
    }

    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // ============================================================================
    // All user preference data is bound as parameters using bind_param().
    // The '?' placeholders ensure user input is treated as data, not executable SQL.
    // Interests come from predefined categories (dropdown), minimizing XSS risk.
    // ============================================================================
    $stmt = $conn->prepare('UPDATE user_accounts SET theme = ?, promotional = ?, reveal_contact_info = ?, interested_category_1 = ?, interested_category_2 = ?, interested_category_3 = ? WHERE user_id = ?');
    $stmt->bind_param('iiisssi', $theme, $promo, $reveal, $int1, $int2, $int3, $userId);  // 'i'=integer, 's'=string
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
        $emailResult = sendPromoWelcomeEmail([
          'firstName' => $userDetails['first_name'],
          'lastName' => $userDetails['last_name'],
          'email' => $userDetails['email']
        ]);
        
        if (!$emailResult['ok']) {
          error_log("Failed to send promo welcome email: " . $emailResult['error']);
        }
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
