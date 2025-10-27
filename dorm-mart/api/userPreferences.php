<?php
header('Content-Type: application/json');

// Include security utilities
require_once __DIR__ . '/security/security.php';
setSecurityHeaders();
setSecureCORS();

require_once __DIR__ . '/auth/auth_handle.php';
require_once __DIR__ . '/database/db_connect.php';

// Include PHPMailer for promo email functionality
$PROJECT_ROOT = dirname(__DIR__, 2);
if (file_exists($PROJECT_ROOT . '/vendor/autoload.php')) {
    require $PROJECT_ROOT . '/vendor/autoload.php';
} else {
    require $PROJECT_ROOT . '/vendor/PHPMailer/src/PHPMailer.php';
    require $PROJECT_ROOT . '/vendor/PHPMailer/src/SMTP.php';
    require $PROJECT_ROOT . '/vendor/PHPMailer/src/Exception.php';
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

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

function sendPromoWelcomeEmail(array $user): array
{
    global $PROJECT_ROOT;

    // Load environment variables
    foreach (["$PROJECT_ROOT/.env.development", "$PROJECT_ROOT/.env.local", "$PROJECT_ROOT/.env.production", "$PROJECT_ROOT/.env.cattle"] as $envFile) {
        if (is_readable($envFile)) {
            foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#')) continue;
                [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
                putenv(trim($k) . '=' . trim($v));
            }
            break;
        }
    }

    // Ensure PHP is using UTF-8 internally
    if (function_exists('mb_internal_encoding')) {
        @mb_internal_encoding('UTF-8');
    }

    $mail = new PHPMailer(true);
    try {
        // SMTP Configuration
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = getenv('GMAIL_USERNAME');
        $mail->Password   = getenv('GMAIL_PASSWORD');
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        $mail->Port       = 465;

        // Optimizations for faster email delivery
        $mail->Timeout = 30;
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
        $mail->setFrom(getenv('GMAIL_USERNAME'), 'Dorm Mart');
        $mail->addReplyTo(getenv('GMAIL_USERNAME'), 'Dorm Mart Support');
        $mail->addAddress($user['email'], trim(($user['firstName'] ?? '') . ' ' . ($user['lastName'] ?? '')));

        $first   = $user['firstName'] ?: 'Student';
        $subject = 'Welcome to Dorm Mart Promotional Updates';

        // HTML email content
        $html = <<<HTML
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>{$subject}</title>
  </head>
  <body style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111;margin:0;padding:16px;background:#111;">
    <div style="max-width:640px;margin:0 auto;background:#1e1e1e;border-radius:8px;padding:20px;">
      <p style="color:#eee;">Dear {$first},</p>
      <p style="color:#eee;">Thank you for opting into promotional updates from <strong>Dorm Mart</strong>!</p>
      <p style="color:#eee;">You'll now receive exciting updates about:</p>
      <ul style="color:#eee;">
        <li>New product listings in your area</li>
        <li>Special deals and discounts</li>
        <li>Community events and announcements</li>
        <li>Tips for buying and selling on campus</li>
      </ul>
      <p style="color:#eee;">We promise to keep our emails relevant and not overwhelm your inbox. You can always update your preferences in your account settings.</p>
      <p style="color:#eee;">Happy trading,<br/>The Dorm Mart Team</p>
      <hr style="border:none;border-top:1px solid #333;margin:16px 0;">
      <p style="font-size:12px;color:#aaa;">This is an automated message; do not reply. For support:
      <a href="mailto:dormmartsupport@gmail.com" style="color:#9db7ff;">dormmartsupport@gmail.com</a></p>
    </div>
  </body>
</html>
HTML;

        // Plain-text version
        $text = <<<TEXT
Dear {$first},

Thank you for opting into promotional updates from Dorm Mart!

You'll now receive exciting updates about:
- New product listings in your area
- Special deals and discounts
- Community events and announcements
- Tips for buying and selling on campus

We promise to keep our emails relevant and not overwhelm your inbox. You can always update your preferences in your account settings.

Happy trading,
The Dorm Mart Team

(This is an automated message; do not reply. Support: dormmartsupport@gmail.com)
TEXT;

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
      
      if ($userRow && !$userRow['received_intro_promo_email']) {
        $shouldSendEmail = true;
      }
    }

    // Update user_accounts table with theme and email preferences
    $stmt = $conn->prepare('UPDATE user_accounts SET theme = ?, prefers_emails = ?, received_intro_promo_email = CASE WHEN ? = 1 AND received_intro_promo_email = 0 THEN 1 ELSE received_intro_promo_email END WHERE user_id = ?');
    $stmt->bind_param('iiii', $theme, $promo, $promo, $userId);
    $result = $stmt->execute();
    if (!$result) {
      error_log("Failed to update user_accounts: " . $stmt->error);
    }
    $stmt->close();

    // Save other preferences to user_preferences table
    $json = json_encode(array_values(array_unique(array_map('strval', $interests))));

    $stmt = $conn->prepare('INSERT INTO user_preferences (user_id, promo_emails, reveal_contact, interests)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE promo_emails = VALUES(promo_emails), reveal_contact = VALUES(reveal_contact), interests = VALUES(interests)');
    $stmt->bind_param('iiis', $userId, $promo, $reveal, $json);
    $stmt->execute();
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
