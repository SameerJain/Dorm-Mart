<?php

// Include security utilities
require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/auth_handle.php';
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
            return ['ok' => true, 'error' => null];
        } else {
            error_log("SendGrid error: " . $statusCode . " - " . $responseBody);
            return ['ok' => false, 'error' => 'Failed to send email via SendGrid'];
        }
    } catch (Exception $e) {
        error_log("SendGrid exception in send_welcome_email_via_sendgrid: " . $e->getMessage());
        return ['ok' => false, 'error' => $e->getMessage()];
    }
}

function send_welcome_gmail(array $user, string $tempPassword): array
{
    global $PROJECT_ROOT;

    // Check for SendGrid API key first (Railway option)
    $sendgridApiKey = getenv('SENDGRID_API_KEY');
    error_log("DEBUG: Checking SendGrid API key for welcome email. Key exists: " . (!empty($sendgridApiKey) ? 'yes' : 'no'));
    if (!empty($sendgridApiKey)) {
        // Use SendGrid REST API for Railway
        error_log("DEBUG: Using SendGrid for welcome email to: " . $user['email']);
        return send_welcome_email_via_sendgrid($user, $tempPassword, $sendgridApiKey);
    }
    error_log("DEBUG: SendGrid API key not found, falling back to PHPMailer");

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
            error_log("Email sending failed: GMAIL_USERNAME or GMAIL_PASSWORD not set. Username set: " . (!empty($gmailUsername) ? 'yes' : 'no'));
            return ['ok' => false, 'error' => 'Email configuration missing'];
        }
        
        $mail->Username   = $gmailUsername;
        $mail->Password   = $gmailPassword;
        $secure = dm_smtp_secure();
        $mail->SMTPSecure = $secure === 'smtps' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = dm_smtp_port();

        // Optimizations for faster email delivery
        $mail->Timeout = dm_smtp_timeout();
        $mail->SMTPKeepAlive = false; // Close connection after sending
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

        $mail->send();
        return ['ok' => true, 'error' => null];
    } catch (Exception $e) {
        $errorMsg = $mail->ErrorInfo ?? $e->getMessage();
        error_log("PHPMailer exception in send_welcome_gmail: " . $errorMsg);
        return ['ok' => false, 'error' => $errorMsg];
    }
}

/**
 * Send promo welcome email via SendGrid REST API (for Railway)
 */
function send_promo_welcome_email_via_sendgrid(array $user, string $apiKey): array
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
        error_log("SendGrid exception in send_promo_welcome_email_via_sendgrid: " . $e->getMessage());
        return ['ok' => false, 'error' => $e->getMessage()];
    }
}

function send_promo_welcome_email(array $user): array
{
    global $PROJECT_ROOT;

    // Check for SendGrid API key first (Railway option)
    $sendgridApiKey = getenv('SENDGRID_API_KEY');
    if (!empty($sendgridApiKey)) {
        // Use SendGrid REST API for Railway
        return send_promo_welcome_email_via_sendgrid($user, $sendgridApiKey);
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
        $gmailUsername = getenv('GMAIL_USERNAME');
        $gmailPassword = getenv('GMAIL_PASSWORD');
        
        // Debug: Log if credentials are missing
        if (empty($gmailUsername) || empty($gmailPassword)) {
            error_log("Email sending failed: GMAIL_USERNAME or GMAIL_PASSWORD not set in send_promo_welcome_email");
            return ['ok' => false, 'error' => 'Email configuration missing'];
        }
        
        $mail->Username   = $gmailUsername;
        $mail->Password   = $gmailPassword;
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



// Include security headers for XSS protection
require_once __DIR__ . '/../security/security.php';
set_security_headers();
set_secure_cors();

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

// XSS PROTECTION: Check for XSS patterns in firstName and lastName fields
// Note: SQL injection is already prevented by prepared statements and regex validation
if (contains_xss_pattern($firstNameRaw) || contains_xss_pattern($lastNameRaw)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid input format']);
    exit;
}

// Load email policy configuration
require_once __DIR__ . '/../config/email_config.php';

// XSS PROTECTION: Input validation with regex patterns to prevent XSS attacks
$firstName = validate_input($firstNameRaw, 100, '/^[a-zA-Z\s\-\']+$/');
$lastName = validate_input($lastNameRaw, 100, '/^[a-zA-Z\s\-\']+$/');
$gradMonth = sanitize_number($data['gradMonth'] ?? 0, 1, 12);
$gradYear  = sanitize_number($data['gradYear'] ?? 0, 1900, 2030);
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

require __DIR__ . '/../database/db_connect.php';
$conn = db();
try {
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $chk = $conn->prepare('SELECT user_id FROM user_accounts WHERE email = ? LIMIT 1');
    $chk->bind_param('s', $email);  // 's' = string type, safely bound as parameter
    $chk->execute();
    $chk->store_result();                   // needed to use num_rows without fetching
    if ($chk->num_rows > 0) {
        http_response_code(200);
        echo json_encode(['ok' => true]);
        exit;
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
    $ins->close();

    if (!$ok) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Insert failed']);
        exit;
    }

    // Send welcome email (non-blocking - don't wait for it to complete)
    // Account creation succeeds even if email fails
    try {
        // Use a shorter timeout and don't block account creation
        $emailResult = @send_welcome_gmail(["firstName" => $firstName, "lastName" => $lastName, "email" => $email], $tempPassword);
        if (!$emailResult['ok']) {
            // Log email sending error but don't fail account creation
            error_log("Failed to send welcome email to {$email}: " . ($emailResult['error'] ?? 'Unknown error'));
        }
    } catch (Throwable $e) {
        // Email sending failed but account was created successfully
        error_log("Exception sending welcome email to {$email}: " . $e->getMessage());
    }

    // Success
    echo json_encode([
        'ok' => true
    ]);
} catch (Throwable $e) {
    // Log $e->getMessage() server-side
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => "There was an error"]);
}
