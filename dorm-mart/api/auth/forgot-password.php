<?php
declare(strict_types=1);

// Include security headers for XSS protection
require __DIR__ . '/../security_headers.php';
require_once __DIR__ . '/../input_sanitizer.php';
require_once __DIR__ . '/utility/security.php';
setSecurityHeaders();

header('Content-Type: application/json; charset=utf-8');

// SECURE CORS Configuration
setSecureCORS();

// Include PHPMailer setup (reuse from create_account.php)
$PROJECT_ROOT = dirname(__DIR__, 2);
if (file_exists($PROJECT_ROOT . '/vendor/autoload.php')) {
    require $PROJECT_ROOT . '/vendor/autoload.php';
} else {
    require $PROJECT_ROOT.'/vendor/PHPMailer/src/PHPMailer.php';
    require $PROJECT_ROOT.'/vendor/PHPMailer/src/SMTP.php';
    require $PROJECT_ROOT.'/vendor/PHPMailer/src/Exception.php';
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Load environment variables (same as create_account.php)
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

// Reuse the same email sending function from create_account.php
function sendPasswordResetEmail(array $user, string $resetLink): array {
    global $PROJECT_ROOT;

    // Ensure PHP is using UTF-8 internally
    if (function_exists('mb_internal_encoding')) {
        @mb_internal_encoding('UTF-8');
    }

    $mail = new PHPMailer(true);
    try {
        // SMTP Configuration (exact same as create_account.php)
        $mail->isSMTP();
        $mail->Host = 'smtp.gmail.com';
        $mail->SMTPAuth = true;
        $mail->Username = getenv('GMAIL_USERNAME');
        $mail->Password = getenv('GMAIL_PASSWORD');
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        $mail->Port = 465;

        // Tell PHPMailer we are sending UTF-8 and how to encode it
        $mail->CharSet = 'UTF-8';
        $mail->Encoding = 'base64';

        // From/To (same as create_account.php)
        $mail->setFrom(getenv('GMAIL_USERNAME'), 'Dorm Mart');
        $mail->addReplyTo(getenv('GMAIL_USERNAME'), 'Dorm Mart Support');
        $mail->addAddress($user['email'], trim($user['first_name'] . ' ' . $user['last_name']));

        $firstName = $user['first_name'] ?: 'Student';
        $subject = 'Reset Your Password - Dorm Mart';

        // Email template (similar to create_account.php but for password reset)
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
      <p style="color:#eee;">Dear {$firstName},</p>
      <p style="color:#eee;">You requested to reset your password for your Dorm Mart account.</p>
      <p style="color:#eee;">Click the link below to reset your password:</p>
      <p style="margin:20px 0;">
        <a href="{$resetLink}" style="background:#007bff;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">Reset Password</a>
      </p>
      <p style="color:#eee;">This link will expire in 1 hour for security reasons.</p>
      <p style="color:#eee;">If you didn't request this password reset, please ignore this email.</p>
      <p style="color:#eee;">Best regards,<br/>The Dorm Mart Team</p>
      <hr style="border:none;border-top:1px solid #333;margin:16px 0;">
      <p style="font-size:12px;color:#aaa;">This is an automated message; do not reply. For support:
      <a href="mailto:dormmartsupport@gmail.com" style="color:#9db7ff;">dormmartsupport@gmail.com</a></p>
    </div>
  </body>
</html>
HTML;

        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body = $html;

        $mail->send();
        return ['success' => true, 'message' => 'Email sent successfully'];

    } catch (Exception $e) {
        return ['success' => false, 'error' => 'Failed to send email: ' . $e->getMessage()];
    }
}

require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/utility/forgot_password_rate_limit.php';

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
    $data = sanitize_json($raw) ?: [];
    $email = validateInput(strtolower(trim((string)($data['email'] ?? ''))), 50, '/^[^@\s]+@buffalo\.edu$/');
} else {
    $email = validateInput(strtolower(trim((string)($_POST['email'] ?? ''))), 50, '/^[^@\s]+@buffalo\.edu$/');
}

if ($email === false) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid email format']);
    exit;
}

try {
    $conn = db();
    
    // Check if email exists
    $stmt = $conn->prepare('SELECT user_id, first_name, last_name, email FROM user_accounts WHERE email = ?');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        $stmt->close();
        $conn->close();
        echo json_encode(['success' => false, 'error' => 'Email not found']);
        exit;
    }
    
    $user = $result->fetch_assoc();
    $stmt->close();
    
    // Check rate limiting
    $rateLimitCheck = check_forgot_password_rate_limit($email);
    if (!$rateLimitCheck['allowed']) {
        $conn->close();
        echo json_encode(['success' => false, 'error' => $rateLimitCheck['error']]);
        exit;
    }
    
    // Generate reset token (same as login system)
    $resetToken = bin2hex(random_bytes(32));
    $hashedToken = password_hash($resetToken, PASSWORD_DEFAULT);
    
    // Set expiration to 1 hour from now
    $expiresAt = date('Y-m-d H:i:s', time() + 3600);
    
    // Store token and expiration in database (reuse hash_auth field)
    $stmt = $conn->prepare('UPDATE user_accounts SET hash_auth = ?, reset_token_expires = ? WHERE user_id = ?');
    $stmt->bind_param('ssi', $hashedToken, $expiresAt, $user['user_id']);
    $stmt->execute();
    $stmt->close();
    
    // Update rate limiting timestamp
    update_reset_request_timestamp($email);
    
    // Generate reset link with correct domain
    $baseUrl = get_reset_password_base_url();
    $resetLink = $baseUrl . '/api/reset-password.php?token=' . $resetToken;
    
    // Send email using the same function as create_account.php
    $emailResult = sendPasswordResetEmail($user, $resetLink);
    
    if (!$emailResult['success']) {
        $conn->close();
        echo json_encode(['success' => false, 'error' => 'Failed to send email']);
        exit;
    }
    
    $conn->close();
    echo json_encode(['success' => true, 'message' => 'Check your email']);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}

function get_reset_password_base_url(): string {
    $host = $_SERVER['HTTP_HOST'] ?? '';
    
    // Production server
    if (strpos($host, 'cattle.cse.buffalo.edu') !== false) {
        return 'https://cattle.cse.buffalo.edu/CSE442/2025-Fall/cse-442j';
    }
    
    // Test server
    if (strpos($host, 'aptitude.cse.buffalo.edu') !== false) {
        return 'https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j';
    }
    
    // Local development - detect Apache vs React dev server
    if ($host === 'localhost' || strpos($host, '127.0.0.1') === 0) {
        // Check if we're running on Apache (serve/dorm-mart path)
        $requestUri = $_SERVER['REQUEST_URI'] ?? '';
        if (strpos($requestUri, '/serve/dorm-mart') !== false) {
            return 'http://localhost/serve/dorm-mart';
        }
        // Otherwise use React dev server
        return 'http://localhost:3000';
    }
    
    // Fallback
    return 'https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j';
}
?>
