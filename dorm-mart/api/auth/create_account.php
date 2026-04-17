<?php

// Include security utilities
require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/auth_handle.php';
setSecurityHeaders();
setSecureCORS();

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


function generatePassword(int $length = 8): string
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
// echo generatePassword(12);

/**
 * Send welcome email via SendGrid REST API (for Railway)
 */
function sendWelcomeEmailViaSendGrid(array $user, string $tempPassword, string $apiKey): array
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

        $email = new \SendGrid\Mail\Mail();
        $email->setFrom("noreply@dormmart.me", "Dorm Mart");
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
        error_log("SendGrid exception in sendWelcomeEmailViaSendGrid: " . $e->getMessage());
        return ['ok' => false, 'error' => $e->getMessage()];
    }
}

function sendWelcomeGmail(array $user, string $tempPassword): array
{
    global $PROJECT_ROOT;

    // Check for SendGrid API key first (Railway option)
    $sendgridApiKey = getenv('SENDGRID_API_KEY');
    error_log("DEBUG: Checking SendGrid API key for welcome email. Key exists: " . (!empty($sendgridApiKey) ? 'yes' : 'no'));
    if (!empty($sendgridApiKey)) {
        // Use SendGrid REST API for Railway
        error_log("DEBUG: Using SendGrid for welcome email to: " . $user['email']);
        return sendWelcomeEmailViaSendGrid($user, $tempPassword, $sendgridApiKey);
    }
    error_log("DEBUG: SendGrid API key not found, falling back to PHPMailer");

    // Otherwise, use existing SMTP code (cattle/aptitude/local)
    // Check if we're on Railway (or similar platform) where env vars are set directly
    // Railway sets RAILWAY_ENVIRONMENT variable, and env vars are already available via getenv()
    if (getenv('RAILWAY_ENVIRONMENT') === false && getenv('DB_HOST') === false) {
        // Not on Railway, load from .env files
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
    }
    // On Railway, environment variables are already set, no need to load from files

    // Ensure PHP is using UTF-8 internally
    if (function_exists('mb_internal_encoding')) {
        @mb_internal_encoding('UTF-8');
    }

    $mail = new PHPMailer(true);
    try {
        // SMTP Configuration with optimizations for production servers
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
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
        // Try STARTTLS on port 587 first (Railway may block port 465)
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;

        // Optimizations for faster email delivery
        $mail->Timeout = 10; // Reduced timeout for faster failure detection (Railway may block SMTP)
        $mail->SMTPKeepAlive = false; // Close connection after sending
        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ];

        // Tell PHPMailer we are sending UTF-8 and how to encode it
        $mail->CharSet   = 'UTF-8';
        $mail->Encoding  = 'base64'; // robust for UTF-8; 'quoted-printable' also fine
        // Optional: $mail->setLanguage('en');

        // From/To
        $mail->setFrom(getenv('GMAIL_USERNAME'), 'Dorm Mart');
        $mail->addReplyTo(getenv('GMAIL_USERNAME'), 'Dorm Mart Support');
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
        error_log("PHPMailer exception in sendWelcomeGmail: " . $errorMsg);
        return ['ok' => false, 'error' => $errorMsg];
    }
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

        $email = new \SendGrid\Mail\Mail();
        $email->setFrom("noreply@dormmart.me", "Dorm Mart");
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
    global $PROJECT_ROOT;

    // Check for SendGrid API key first (Railway option)
    $sendgridApiKey = getenv('SENDGRID_API_KEY');
    if (!empty($sendgridApiKey)) {
        // Use SendGrid REST API for Railway
        return sendPromoWelcomeEmailViaSendGrid($user, $sendgridApiKey);
    }

    // Otherwise, use existing SMTP code (cattle/aptitude/local)
    // Check if we're on Railway (or similar platform) where env vars are set directly
    // Railway sets RAILWAY_ENVIRONMENT variable, and env vars are already available via getenv()
    if (getenv('RAILWAY_ENVIRONMENT') === false && getenv('DB_HOST') === false) {
        // Not on Railway, load from .env files
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
    }
    // On Railway, environment variables are already set, no need to load from files

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
        $gmailUsername = getenv('GMAIL_USERNAME');
        $gmailPassword = getenv('GMAIL_PASSWORD');
        
        // Debug: Log if credentials are missing
        if (empty($gmailUsername) || empty($gmailPassword)) {
            error_log("Email sending failed: GMAIL_USERNAME or GMAIL_PASSWORD not set in sendPromoWelcomeEmail");
            return ['ok' => false, 'error' => 'Email configuration missing'];
        }
        
        $mail->Username   = $gmailUsername;
        $mail->Password   = $gmailPassword;
        // Try STARTTLS on port 587 first (Railway may block port 465)
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;

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
setSecurityHeaders();
setSecureCORS();

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
if (containsXSSPattern($firstNameRaw) || containsXSSPattern($lastNameRaw)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid input format']);
    exit;
}

// Load email policy configuration
require_once __DIR__ . '/../config/email_config.php';

// XSS PROTECTION: Input validation with regex patterns to prevent XSS attacks
$firstName = validateInput($firstNameRaw, 100, '/^[a-zA-Z\s\-\']+$/');
$lastName = validateInput($lastNameRaw, 100, '/^[a-zA-Z\s\-\']+$/');
$gradMonth = sanitize_number($data['gradMonth'] ?? 0, 1, 12);
$gradYear  = sanitize_number($data['gradYear'] ?? 0, 1900, 2030);
$promos    = !empty($data['promos']);

// Email validation based on ALLOW_ALL_EMAILS flag
if (ALLOW_ALL_EMAILS) {
    // Accept any valid email format
    $email = validateInput($emailRaw, 255, '/^[^@\s]+@[^@\s]+\.[^@\s]+$/');
    if ($email === false || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid email format']);
        exit;
    }
} else {
    // Only accept @buffalo.edu
    $email = validateInput($emailRaw, 255, '/^[^@\s]+@buffalo\.edu$/');
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
    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // ============================================================================
    // Check if email already exists using prepared statement.
    // The '?' placeholder and bind_param() ensure $email is treated as data, not SQL.
    // This prevents SQL injection even if malicious SQL code is in the email field.
    // ============================================================================
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
    // SECURITY NOTE:
    // We NEVER store plaintext passwords. We generate a temporary password for the
    // new user and immediately hash it with password_hash(), which automatically
    // generates a unique SALT and embeds it into the returned hash (bcrypt here).
    // The database only stores this salted, one-way hash (column: hash_pass).
    $tempPassword = generatePassword(8);
    $hashPass     = password_hash($tempPassword, PASSWORD_BCRYPT);

    // 3) Insert user
    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // ============================================================================
    // All user input (firstName, lastName, email, etc.) is inserted using prepared statement
    // with parameter binding. The '?' placeholders ensure user input is treated as data,
    // not executable SQL. This prevents SQL injection attacks even if malicious SQL code
    // is present in any of the input fields.
    // ============================================================================
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
        $emailResult = @sendWelcomeGmail(["firstName" => $firstName, "lastName" => $lastName, "email" => $email], $tempPassword);
        if (!$emailResult['ok']) {
            // Log email sending error but don't fail account creation
            error_log("Failed to send welcome email to {$email}: " . ($emailResult['error'] ?? 'Unknown error'));
        }
    } catch (Throwable $e) {
        // Email sending failed but account was created successfully
        error_log("Exception sending welcome email to {$email}: " . $e->getMessage());
    }

    // Promo email is no longer sent during account creation
    // Promo emails will only be sent from user preferences settings
    // The promotional preference is still saved to the database above
    /*
    // Send promo welcome email if user opted into promotional emails
    if ($promos) {
        $promoEmailResult = sendPromoWelcomeEmail(["firstName" => $firstName, "lastName" => $lastName, "email" => $email]);
        if (!$promoEmailResult['ok']) {
            error_log("Failed to send promo welcome email during account creation: " . $promoEmailResult['error']);
        }
    }
    */

    // Success
    echo json_encode([
        'ok' => true
    ]);
} catch (Throwable $e) {
    // Log $e->getMessage() server-side
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => "There was an error"]);
}
