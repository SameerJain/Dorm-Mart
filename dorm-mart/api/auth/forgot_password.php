<?php

declare(strict_types=1);

// Include security headers for XSS protection
require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();

header('Content-Type: application/json; charset=utf-8');

// SECURE CORS Configuration
setSecureCORS();

// Include PHPMailer setup (reuse from create_account.php)
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

/**
 * Send password reset email via SendGrid REST API (for Railway)
 */
function sendPasswordResetEmailViaSendGrid(array $user, string $resetLink, string $apiKey): array
{
    global $PROJECT_ROOT;
    
    // Load SendGrid SDK
    if (file_exists($PROJECT_ROOT . '/vendor/autoload.php')) {
        require_once $PROJECT_ROOT . '/vendor/autoload.php';
    } else {
        error_log("SendGrid: vendor/autoload.php not found");
        return ['success' => false, 'error' => 'SendGrid SDK not available'];
    }
    
    try {
        $sendgrid = new \SendGrid($apiKey);
        
        $pkg = dm_transactional_password_reset_package($user['first_name'] ?? '', $resetLink);
        $subject = $pkg['subject'];
        $html = $pkg['html'];
        $text = $pkg['text'];

        $fromEmail = dm_mail_from_email();
        if ($fromEmail === '') {
            error_log("SendGrid password reset failed: MAIL_FROM_EMAIL or GMAIL_USERNAME is not set");
            return ['success' => false, 'error' => 'Email configuration missing'];
        }

        $email = new \SendGrid\Mail\Mail();
        $email->setFrom($fromEmail, dm_mail_from_name());
        $email->setSubject($subject);
        $email->addTo($user['email'], trim($user['first_name'] . ' ' . $user['last_name']));
        $email->addContent("text/html", $html);
        $email->addContent("text/plain", $text);
        
        $response = $sendgrid->send($email);
        $statusCode = $response->statusCode();
        $responseBody = $response->body();
        
        error_log("SendGrid response: Status " . $statusCode . " - Body: " . $responseBody);
        
        if ($statusCode >= 200 && $statusCode < 300) {
            error_log("SendGrid password reset email sent successfully to: " . $user['email']);
            return ['success' => true, 'message' => 'Email sent successfully'];
        } else {
            error_log("SendGrid error in password reset: " . $statusCode . " - " . $responseBody);
            return ['success' => false, 'error' => 'Failed to send email via SendGrid'];
        }
    } catch (Exception $e) {
        error_log("SendGrid exception in sendPasswordResetEmailViaSendGrid: " . $e->getMessage());
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

// Use the EXACT same email sending logic as create_account.php for maximum speed
function sendPasswordResetEmail(array $user, string $resetLink, string $envLabel = 'Local'): array
{
    global $PROJECT_ROOT;

    // Check for SendGrid API key first (Railway option)
    $sendgridApiKey = getenv('SENDGRID_API_KEY');
    error_log("DEBUG: Checking SendGrid API key. Key exists: " . (!empty($sendgridApiKey) ? 'yes' : 'no'));
    if (!empty($sendgridApiKey)) {
        // Use SendGrid REST API for Railway
        error_log("DEBUG: Using SendGrid for password reset email to: " . $user['email']);
        return sendPasswordResetEmailViaSendGrid($user, $resetLink, $sendgridApiKey);
    }
    error_log("DEBUG: SendGrid API key not found, falling back to PHPMailer");

    // Ensure PHP is using UTF-8 internally (EXACT same as create_account.php)
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
            error_log("Email sending failed: GMAIL_USERNAME or GMAIL_PASSWORD not set in sendPasswordResetEmail");
            return ['success' => false, 'error' => 'Email configuration missing'];
        }
        
        $mail->Username   = $gmailUsername;
        $mail->Password   = $gmailPassword;
        $secure = dm_smtp_secure();
        $mail->SMTPSecure = $secure === 'smtps' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = dm_smtp_port();

        // Optimizations for faster email delivery
        $mail->Timeout = dm_smtp_timeout();
        $mail->SMTPKeepAlive = false; // Close connection after sending
        // Tell PHPMailer we are sending UTF-8 and how to encode it (EXACT same as create_account.php)
        $mail->CharSet   = 'UTF-8';
        $mail->Encoding  = 'base64';

        // From/To (EXACT same as create_account.php)
        $mail->setFrom(dm_mail_from_email(), dm_mail_from_name());
        $mail->addReplyTo(dm_mail_reply_to_email(), dm_mail_reply_to_name());
        $mail->addAddress($user['email'], trim($user['first_name'] . ' ' . $user['last_name']));

        $pkg = dm_transactional_password_reset_package($user['first_name'] ?? '', $resetLink);
        $subject = $pkg['subject'];
        $html = $pkg['html'];
        $text = $pkg['text'];

        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body = $html;
        $mail->AltBody = $text;

        $sendStartTime = microtime(true);
        $mail->send();
        $sendEndTime = microtime(true);
        $sendDuration = round(($sendEndTime - $sendStartTime) * 1000, 2);
        error_log("PHPMailer send() duration: {$sendDuration}ms");
        return ['success' => true, 'message' => 'Email sent successfully'];
    } catch (Exception $e) {
        return ['success' => false, 'error' => 'Failed to send email: ' . $e->getMessage()];
    }
}

require_once __DIR__ . '/../database/db_connect.php';

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

// Get request data
$ct = $_SERVER['CONTENT_TYPE'] ?? '';
if (strpos($ct, 'application/json') !== false) {
    $raw = file_get_contents('php://input');
    // IMPORTANT: Decode JSON first, then validate - don't HTML-encode email before validation
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        $data = [];
    }
    $emailRaw = strtolower(trim((string)($data['email'] ?? '')));
} else {
    $emailRaw = strtolower(trim((string)($_POST['email'] ?? '')));
}

// Load email policy configuration
require_once __DIR__ . '/../config/email_config.php';

// XSS PROTECTION: Filtering (Layer 1) - blocks patterns before DB storage
// Note: SQL injection prevented by prepared statements
if ($emailRaw !== '' && contains_xss_pattern($emailRaw)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid input format']);
    exit;
}

// Email validation based on ALLOW_ALL_EMAILS flag
if (ALLOW_ALL_EMAILS) {
    // Accept any valid email format
    $email = validate_input($emailRaw, 255, '/^[^@\s]+@[^@\s]+\.[^@\s]+$/');
    if ($email === false || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid email format']);
        exit;
    }
} else {
    // Only accept @buffalo.edu
    $email = validate_input($emailRaw, 255, '/^[^@\s]+@buffalo\.edu$/');
    if ($email === false || !preg_match('/^[^@\s]+@buffalo\.edu$/', $email)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Email must be @buffalo.edu']);
        exit;
    }
}

try {
    $conn = db();

    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // ============================================================================
    // Using prepared statement with '?' placeholder and bind_param() to safely
    // handle $email. Even if malicious SQL is in $email, it cannot execute
    // because it's bound as a string parameter, not concatenated into SQL.
    // ============================================================================
    $stmt = $conn->prepare('SELECT user_id, first_name, last_name, email, last_reset_request FROM user_accounts WHERE email = ?');
    $stmt->bind_param('s', $email);  // 's' = string type, safely bound as parameter
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        $conn->close();
        // Return the same response as a successful send to prevent email enumeration
        echo json_encode(['success' => true, 'message' => 'If this email is registered, a reset link has been sent.']);
        exit;
    }

    $user = $result->fetch_assoc();
    $stmt->close();

    // Check rate limiting (optimized inline check)
    if ($user['last_reset_request']) {
        $stmt = $conn->prepare('SELECT TIMESTAMPDIFF(MINUTE, ?, NOW()) as minutes_passed');
        $stmt->bind_param('s', $user['last_reset_request']);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $minutesPassed = (int)$row['minutes_passed'];
        $stmt->close();

        if ($minutesPassed < 10) { // 10 minute rate limit
            $remainingMinutes = 10 - $minutesPassed;
            $conn->close();
            echo json_encode(['success' => false, 'error' => "Please wait {$remainingMinutes} minutes before requesting another reset link"]);
            exit;
        }
    }

    // Generate reset token (same as login system)
    $resetToken = bin2hex(random_bytes(32));
    $hashedToken = password_hash($resetToken, PASSWORD_BCRYPT);

    // Set expiration to 1 hour from now using UTC timezone
    $expiresAt = (new DateTime('+1 hour', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');

    // Store token, expiration, and update timestamp in one query
    $stmt = $conn->prepare('UPDATE user_accounts SET hash_auth = ?, reset_token_expires = ?, last_reset_request = NOW() WHERE user_id = ?');
    $stmt->bind_param('ssi', $hashedToken, $expiresAt, $user['user_id']);
    $stmt->execute();
    $stmt->close();

    $resetLink = dm_api_url('redirects/handle_password_reset_token_redirect.php') . '?token=' . urlencode($resetToken);
    $envLabel = dm_env_string('APP_ENV', 'Local');

    // Send email using the same function as create_account.php
    $emailStartTime = microtime(true);
    $emailResult = sendPasswordResetEmail($user, $resetLink, $envLabel);
    $emailEndTime = microtime(true);
    $emailDuration = round(($emailEndTime - $emailStartTime) * 1000, 2); // milliseconds
    
    // Debug: Log email timing
    error_log("Reset password email duration: {$emailDuration}ms");

    if (!$emailResult['success']) {
        $conn->close();
        echo json_encode(['success' => false, 'error' => 'Failed to send email']);
        exit;
    }

    $conn->close();
    echo json_encode([
        'success' => true,
        'message' => 'If this email is registered, a reset link has been sent.',
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}
