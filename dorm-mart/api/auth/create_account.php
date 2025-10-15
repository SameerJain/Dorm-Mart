<?php

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
    require $PROJECT_ROOT.'/vendor/PHPMailer/src/PHPMailer.php';
    require $PROJECT_ROOT.'/vendor/PHPMailer/src/SMTP.php';
    require $PROJECT_ROOT.'/vendor/PHPMailer/src/Exception.php';
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;




function generatePassword(int $length = 12): string {
    if ($length < 8) $length = 8;

    $uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $lowers = 'abcdefghijklmnopqrstuvwxyz';
    $digits = '0123456789';
    $special = '!@#$%^&*()-_=+[]{};:,.?/';

    // ensure each required class is present
    $password = [
        $uppers[random_int(0, strlen($uppers) - 1)],
        $lowers[random_int(0, strlen($lowers) - 1)],
        $digits[random_int(0, strlen($digits) - 1)],
        $special[random_int(0, strlen($special) - 1)],
    ];

    // fill the rest
    $all = $uppers . $lowers . $digits . $special;
    for ($i = count($password); $i < $length; $i++) {
        $password[] = $all[random_int(0, strlen($all) - 1)];
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

function sendWelcomeGmail(array $user, string $tempPassword): array {
    global $PROJECT_ROOT;

    // pick an env file (cleaned)
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
        // SMTP
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = getenv('GMAIL_USERNAME');
        $mail->Password   = getenv('GMAIL_PASSWORD');
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS; // or STARTTLS 587
        $mail->Port       = 465;

        // Tell PHPMailer we are sending UTF-8 and how to encode it
        $mail->CharSet   = 'UTF-8';
        $mail->Encoding  = 'base64'; // robust for UTF-8; 'quoted-printable' also fine
        // Optional: $mail->setLanguage('en');

        // From/To
        $mail->setFrom(getenv('GMAIL_USERNAME'), 'Dorm Mart');
        $mail->addReplyTo(getenv('GMAIL_USERNAME'), 'Dorm Mart Support');
        $mail->addAddress($user['email'], trim(($user['firstName'] ?? '').' '.($user['lastName'] ?? '')));

        $first   = $user['firstName'] ?: 'Student';
        $subject = 'Welcome to Dorm Mart';

        // Use HTML entities for punctuation (— →) to avoid mojibake in some clients
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
      <p style="color:#eee;">Welcome to <strong>Dorm Mart</strong> &mdash; the student marketplace for UB.</p>
      <p style="color:#eee;">Here is your temporary (current) password. <strong>DO NOT</strong> share this with anyone.</p>
      <p style="font-size:20px;color:#fff;"><strong>{$tempPassword}</strong></p>
      <p style="color:#eee;">If you want to change this password, go to <em>Settings &rarr; Change Password</em>.</p>
      <p style="color:#eee;">Happy trading,<br/>The Dorm Mart Team</p>
      <hr style="border:none;border-top:1px solid #333;margin:16px 0;">
      <p style="font-size:12px;color:#aaa;">This is an automated message; do not reply. For support:
      <a href="mailto:dormmartsupport@gmail.com" style="color:#9db7ff;">dormmartsupport@gmail.com</a></p>
    </div>
  </body>
</html>
HTML;

        // Plain-text part: stick to ASCII symbols
        $text = <<<TEXT
Dear {$first},

Welcome to Dorm Mart - the student marketplace for UB.

Here is your temporary (current) password. DO NOT share this with anyone.

{$tempPassword}

If you want to change this password, go to Settings -> Change Password.

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



header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

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

// Extract the values
$firstName = trim($data['firstName'] ?? '');
$lastName  = trim($data['lastName'] ?? '');
$gradMonth = $data['gradMonth'] ?? '';
$gradYear  = $data['gradYear'] ?? '';
$email     = strtolower(trim($data['email'] ?? ''));
$promos    = !empty($data['promos']);

// Validate
if ($firstName === '' || $lastName === '' || $email === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing required fields']);
    exit;
}

if (!preg_match('/^[^@\s]+@buffalo\.edu$/', $email)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Email must be @buffalo.edu']);
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

require "../db_connect.php";
$conn = db();
try {
  $chk = $conn->prepare('SELECT user_id FROM user_accounts WHERE email = ? LIMIT 1');
$chk->bind_param('s', $email);
$chk->execute();
$chk->store_result();                   // needed to use num_rows without fetching
if ($chk->num_rows > 0) {
  http_response_code(200);
  echo json_encode(['ok'=>true]);
  exit;
}
$chk->close();

// 2) Generate & hash password
// SECURITY NOTE:
// We NEVER store plaintext passwords. We generate a temporary password for the
// new user and immediately hash it with password_hash(), which automatically
// generates a unique SALT and embeds it into the returned hash (bcrypt here).
// The database only stores this salted, one-way hash (column: hash_pass).
$tempPassword = generatePassword(12);
$hashPass     = password_hash($tempPassword, PASSWORD_BCRYPT);

// 3) Insert user
$sql = 'INSERT INTO user_accounts
          (first_name, last_name, grad_month, grad_year, email, promotional, hash_pass, hash_auth, join_date, seller, theme)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, NULL, CURRENT_DATE, 0, 0)';

$ins = $conn->prepare($sql);
/*
 types: s=string, i=int
 first_name(s), last_name(s), grad_month(i), grad_year(i),
 email(s), promotional(i), hash_pass(s), hash_auth(s)
*/
$promotional = $promos ? 1 : 0;
$ins->bind_param(
  'ssiisis',
  $firstName,
  $lastName,
  $gradMonth,
  $gradYear,
  $email,
  $promotional,
  $hashPass,
);

$ok = $ins->execute();
$ins->close();

if (!$ok) {
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>'Insert failed']);
  exit;
}

// Send email (ignore result here)
sendWelcomeGmail(["firstName"=>$firstName,"lastName"=>$lastName,"email"=>$email], $tempPassword);

// Success
echo json_encode([
  'ok' => true
]);

} catch (Throwable $e) {
  // Log $e->getMessage() server-side
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>"There was an error"]);
}


