<?php

// Include security utilities
require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/auth_handle.php';
dm_enforce_https();
set_security_headers();
set_secure_cors();

header('Content-Type: application/json; charset=utf-8');

/*composer needs to be installed in order to enable mailing services
Get composer from getcomposer.org
Run in cmd at dorm-mart
composer require phpmailer/phpmailer

If composer cannot be installed or is giving errors then follow the following steps:
1. Download PHPMailer ZIP: https://github.com/PHPMailer/PHPMailer/releases
2. Extract src/ into dorm-mart/vendor/PHPMailer/src
*/


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

require_once __DIR__ . '/../utility/transactional_email_html.php';
require_once __DIR__ . '/../config/app_config.php';

const ACCOUNT_REQUEST_ACCEPTED_MESSAGE = 'If eligible, account instructions will be sent.';
$accountRequestStartedAt = microtime(true);

function accept_account_request(): void
{
    global $accountRequestStartedAt;
    $remainingMicros = (int)max(0, (2 - (microtime(true) - $accountRequestStartedAt)) * 1000000);
    if ($remainingMicros > 0) {
        usleep($remainingMicros);
    }
    http_response_code(202);
    echo json_encode([
        'ok' => true,
        'message' => ACCOUNT_REQUEST_ACCEPTED_MESSAGE,
    ]);
    exit;
}

function remove_undeliverable_account(mysqli $conn, int $userId, string $email, string $requestId): bool
{
    try {
        $stmt = $conn->prepare('DELETE FROM user_accounts WHERE user_id = ? AND email = ?');
        $stmt->bind_param('is', $userId, $email);
        $stmt->execute();
        $removed = $stmt->affected_rows === 1;
        $stmt->close();
        dm_log_auth_event('create_account', $requestId, $removed ? 'account_cleanup_succeeded' : 'account_cleanup_failed', [
            'user_id' => $userId,
        ]);
        return $removed;
    } catch (Throwable $e) {
        dm_log_auth_event('create_account', $requestId, 'account_cleanup_failed', [
            'user_id' => $userId,
            'error' => $e->getMessage(),
        ]);
        return false;
    }
}


function generate_password(int $length = 8): string
{
    // Fixed length of 8 characters
    $length = 8;

    $uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $lowers = 'abcdefghijklmnopqrstuvwxyz';
    $digits = '0123456789';
    $special = '!@#$%^&*()-_=+[]{};:,.?/';

    // Generate exactly 1 special character
    $password = [
        $special[random_int(0, strlen($special) - 1)],
    ];

    // Ensure at least 1 uppercase, 1 lowercase, and 1 digit (remaining 7 characters)
    $password[] = $uppers[random_int(0, strlen($uppers) - 1)];
    $password[] = $lowers[random_int(0, strlen($lowers) - 1)];
    $password[] = $digits[random_int(0, strlen($digits) - 1)];

    // Fill the remaining 4 characters from uppercase, lowercase, or digits only (no special)
    $nonSpecial = $uppers . $lowers . $digits;
    for ($i = count($password); $i < $length; $i++) {
        $password[] = $nonSpecial[random_int(0, strlen($nonSpecial) - 1)];
    }

    // secure shuffle (Fisher–Yates)
    for ($i = count($password) - 1; $i > 0; $i--) {
        $j = random_int(0, $i);
        [$password[$i], $password[$j]] = [$password[$j], $password[$i]];
    }

    return implode('', $password);
}

// Example:
// echo generate_password(12);

/**
 * Send welcome email via SendGrid REST API (for Railway)
 */
function send_welcome_email_via_sendgrid(array $user, string $tempPassword, string $apiKey): array
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
        error_log("SendGrid welcome email attempt started for: " . ($user['email'] ?? 'unknown'));
        $sendgrid = new \SendGrid($apiKey);

        $pkg = dm_transactional_welcome_package($user['firstName'] ?? '', $tempPassword);
        $subject = $pkg['subject'];
        $html = $pkg['html'];
        $text = $pkg['text'];

        $fromEmail = dm_mail_from_email();
        if ($fromEmail === '') {
            error_log("SendGrid welcome email failed: MAIL_FROM_EMAIL or GMAIL_USERNAME is not set");
            return ['ok' => false, 'error' => 'Email configuration missing'];
        }

        $email = new \SendGrid\Mail\Mail();
        $email->setFrom($fromEmail, dm_mail_from_name());
        $email->setSubject($subject);
        $email->addTo($user['email'], trim(($user['firstName'] ?? '') . ' ' . ($user['lastName'] ?? '')));
        $email->addContent("text/html", $html);
        $email->addContent("text/plain", $text);
        
        $response = $sendgrid->send($email);
        $statusCode = $response->statusCode();
        $responseBody = $response->body();

        error_log("SendGrid response: Status " . $statusCode . " - Body: " . $responseBody);
        
        if ($statusCode >= 200 && $statusCode < 300) {
            error_log("SendGrid email sent successfully to: " . $user['email']);
            return ['ok' => true, 'provider' => 'sendgrid', 'status' => $statusCode, 'error' => null];
        } else {
            error_log("SendGrid error: " . $statusCode . " - " . $responseBody);
            return ['ok' => false, 'provider' => 'sendgrid', 'status' => $statusCode, 'error' => 'Failed to send email via SendGrid'];
        }
    } catch (Throwable $e) {
        error_log("SendGrid exception in send_welcome_email_via_sendgrid: " . $e->getMessage());
        return ['ok' => false, 'provider' => 'sendgrid', 'error' => $e->getMessage()];
    }
}

function send_welcome_gmail(array $user, string $tempPassword): array
{
    global $PROJECT_ROOT;

    // Check for SendGrid API key first (Railway option)
    $sendgridApiKey = dm_sendgrid_api_key();
    if (!empty($sendgridApiKey)) {
        // Use SendGrid REST API for Railway
        error_log("Welcome email using SendGrid; SENDGRID_API_KEY is configured");
        return send_welcome_email_via_sendgrid($user, $tempPassword, $sendgridApiKey);
    }
    error_log("Welcome email using SMTP fallback; SENDGRID_API_KEY is not configured");

    // Ensure PHP is using UTF-8 internally
    if (function_exists('mb_internal_encoding')) {
        @mb_internal_encoding('UTF-8');
    }

    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = dm_smtp_host();
        $mail->SMTPAuth   = true;
        $gmailUsername = getenv('GMAIL_USERNAME');
        $gmailPassword = getenv('GMAIL_PASSWORD');
        
        // Debug: Log if credentials are missing (but don't expose passwords)
        if (empty($gmailUsername) || empty($gmailPassword)) {
            error_log("Email sending failed: GMAIL_USERNAME or GMAIL_PASSWORD not set. Username set: " . (!empty($gmailUsername) ? 'yes' : 'no') . ", password set: " . (!empty($gmailPassword) ? 'yes' : 'no'));
            return ['ok' => false, 'provider' => 'smtp', 'error' => 'Email configuration missing'];
        }
        
        $mail->Username   = $gmailUsername;
        $mail->Password   = $gmailPassword;
        $secure = dm_smtp_secure();
        $mail->SMTPSecure = $secure === 'smtps' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = dm_smtp_port();

        // Optimizations for faster email delivery
        $mail->Timeout = dm_smtp_timeout();
        $mail->SMTPKeepAlive = false;
        $allowSelfSigned = dm_smtp_allow_self_signed();
        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer'       => !$allowSelfSigned,
                'verify_peer_name'  => !$allowSelfSigned,
                'allow_self_signed' => $allowSelfSigned,
            ]
        ];
        // Tell PHPMailer we are sending UTF-8 and how to encode it
        $mail->CharSet   = 'UTF-8';
        $mail->Encoding  = 'base64'; // robust for UTF-8; 'quoted-printable' also fine
        // Optional: $mail->setLanguage('en');

        // From/To
        $mail->setFrom(dm_mail_from_email(), dm_mail_from_name());
        $mail->addReplyTo(dm_mail_reply_to_email(), dm_mail_reply_to_name());
        $mail->addAddress($user['email'], trim(($user['firstName'] ?? '') . ' ' . ($user['lastName'] ?? '')));

        $pkg = dm_transactional_welcome_package($user['firstName'] ?? '', $tempPassword);
        $subject = $pkg['subject'];
        $html = $pkg['html'];
        $text = $pkg['text'];

        $mail->Subject = $subject;
        $mail->isHTML(true);
        $mail->Body    = $html;
        $mail->AltBody = $text;

        error_log("SMTP welcome email attempt started for: " . ($user['email'] ?? 'unknown'));
        $mail->send();
        error_log("SMTP welcome email sent successfully to: " . ($user['email'] ?? 'unknown'));
        return ['ok' => true, 'provider' => 'smtp', 'error' => null];
    } catch (Throwable $e) {
        $errorMsg = $mail->ErrorInfo ?? $e->getMessage();
        error_log("PHPMailer exception in send_welcome_gmail: " . $errorMsg);
        return ['ok' => false, 'provider' => 'smtp', 'error' => $errorMsg];
    }
}

header('Content-Type: application/json; charset=utf-8');

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Enforce POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method Not Allowed']);
    exit;
}

// Read the JSON body from React's fetch()
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

// Handle bad JSON
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid JSON body']);
    exit;
}

// Extract the values (before validation)
$firstNameRaw = trim($data['firstName'] ?? '');
$lastNameRaw = trim($data['lastName'] ?? '');
$emailRaw = strtolower(trim($data['email'] ?? ''));

// Load email policy configuration
require_once __DIR__ . '/../config/email_config.php';

// Input validation with regex patterns
$firstName = validate_input($firstNameRaw, 30, '/^[a-zA-Z\s\-]+$/');
$lastName = validate_input($lastNameRaw, 30, '/^[a-zA-Z\s\-]+$/');
$gradMonth = sanitize_number($data['gradMonth'] ?? 0, 1, 12);
$gradYear  = sanitize_number($data['gradYear'] ?? 0, 1900, (int)date('Y') + 8);
$promos    = !empty($data['promos']);

// Email validation based on ALLOW_ALL_EMAILS flag
if (ALLOW_ALL_EMAILS) {
    // Accept any valid email format
    $email = validate_input($emailRaw, 255, '/^[^@\s]+@[^@\s]+\.[^@\s]+$/');
    if ($email === false || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid email format']);
        exit;
    }
} else {
    // Only accept @buffalo.edu
    $email = validate_input($emailRaw, 255, '/^[^@\s]+@buffalo\.edu$/');
    if ($email === false || !preg_match('/^[^@\s]+@buffalo\.edu$/', $email)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Email must be @buffalo.edu']);
        exit;
    }
}

if ($firstName === false || $lastName === false || $email === false) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid input format']);
    exit;
}

$emailLocalPart = explode('@', $email)[0] ?? '';
if (preg_match('/^\d+$/', $emailLocalPart)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid email format']);
    exit;
}

// Validate
if ($firstName === '' || $lastName === '' || $email === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing required fields']);
    exit;
}
// --- Validate graduation date format ---
if ($gradMonth < 1 || $gradMonth > 12 || $gradYear < 1900) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid graduation date']);
    exit;
}

// --- Current and limit dates ---
$currentYear  = (int)date('Y');
$currentMonth = (int)date('n');
$maxFutureYear = $currentYear + 8;

// --- Check for past date ---
if ($gradYear < $currentYear || ($gradYear === $currentYear && $gradMonth < $currentMonth)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Graduation date cannot be in the past']);
    exit;
}

// --- Check for excessive future date ---
if ($gradYear > $maxFutureYear || ($gradYear === $maxFutureYear && $gradMonth > $currentMonth)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Graduation date cannot be more than 8 years in the future']);
    exit;
}

$requestId = bin2hex(random_bytes(8));
require __DIR__ . '/../database/db_connect.php';
try {
    $conn = db();
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $chk = $conn->prepare('SELECT user_id FROM user_accounts WHERE email = ? LIMIT 1');
    $chk->bind_param('s', $email);  // 's' = string type, safely bound as parameter
    $chk->execute();
    $chk->store_result();                   // needed to use num_rows without fetching
    if ($chk->num_rows > 0) {
        $chk->close();
        $conn->close();
        dm_log_auth_event('create_account', $requestId, 'duplicate_request');
        accept_account_request();
    }
    $chk->close();

    // 2) Generate & hash password
    // SECURITY NOTE: Store only the salted password hash.
    $tempPassword = generate_password(8);
    $hashPass     = password_hash($tempPassword, PASSWORD_BCRYPT);

    // 3) Insert user
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $sql = 'INSERT INTO user_accounts
          (first_name, last_name, grad_month, grad_year, email, promotional, hash_pass, hash_auth, join_date, seller, theme, received_intro_promo_email)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, NULL, CURRENT_DATE, 0, 0, ?)';

    $ins = $conn->prepare($sql);
    /*
    types: s=string, i=int
    first_name(s), last_name(s), grad_month(i), grad_year(i),
    email(s), promotional(i), hash_pass(s), hash_auth(s), received_intro_promo_email(i)
*/
    $promotional = $promos ? 1 : 0;
    $receivedIntroPromoEmail = $promos ? 1 : 0; // Set to TRUE if promotional emails are enabled
    $ins->bind_param(
        'ssiisisi',
        $firstName,
        $lastName,
        $gradMonth,
        $gradYear,
        $email,
        $promotional,
        $hashPass,
        $receivedIntroPromoEmail,
    );

    $ok = $ins->execute();
    $newUserId = (int)$conn->insert_id;
    $ins->close();

    if (!$ok) {
        dm_log_auth_event('create_account', $requestId, 'insert_failed');
        $conn->close();
        accept_account_request();
    }

    try {
        dm_log_auth_event('create_account', $requestId, 'delivery_started', ['user_id' => $newUserId]);
        $emailResult = send_welcome_gmail(["firstName" => $firstName, "lastName" => $lastName, "email" => $email], $tempPassword);
        if (!$emailResult['ok']) {
            dm_log_auth_event('create_account', $requestId, 'delivery_failed', [
                'user_id' => $newUserId,
                'provider' => $emailResult['provider'] ?? 'unknown',
                'error' => $emailResult['error'] ?? 'Unknown error',
            ]);
            remove_undeliverable_account($conn, $newUserId, $email, $requestId);
            $newUserId = 0;
            $conn->close();
            accept_account_request();
        } else {
            dm_log_auth_event('create_account', $requestId, 'accepted', [
                'user_id' => $newUserId,
                'provider' => $emailResult['provider'] ?? 'unknown',
            ]);
        }
    } catch (Throwable $e) {
        dm_log_auth_event('create_account', $requestId, 'delivery_failed', [
            'user_id' => $newUserId,
            'error' => $e->getMessage(),
        ]);
        remove_undeliverable_account($conn, $newUserId, $email, $requestId);
        $newUserId = 0;
        $conn->close();
        accept_account_request();
    }

    $conn->close();
    accept_account_request();
} catch (Throwable $e) {
    dm_log_auth_event('create_account', $requestId, 'internal_error', ['error' => $e->getMessage()]);
    if (isset($conn) && $conn instanceof mysqli) {
        if (!empty($newUserId)) {
            remove_undeliverable_account($conn, (int)$newUserId, $email, $requestId);
        }
        $conn->close();
    }
    accept_account_request();
}
