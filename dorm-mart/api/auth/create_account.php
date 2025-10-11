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
    // load whichever exists 
    global $PROJECT_ROOT;
    $devEnvFile = "$PROJECT_ROOT/.env.development";
    $localEnvFile = "$PROJECT_ROOT/.env.local";
    $prodEnvFile = "$PROJECT_ROOT/.env.production";
    $localEnvFile = "$PROJECT_ROOT/.env.local";
    if (file_exists($devEnvFile)) {
        $envFile = $devEnvFile;
    } elseif(file_exists($localEnvFile)){
        $endFile = $localEnvFile;
    } elseif (file_exists($prodEnvFile)) {
        $envFile = $prodEnvFile;
    } 
    else if (file_exists($localEnvFile)){
        $envFile = $localEnvFile;
    }
    else {
        echo json_encode(["success" => false, "message" => "No .env file found"]);
        exit;
    }
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) continue;
        [$key, $value] = array_pad(explode('=', $line, 2), 2, '');
        putenv(trim($key) . '=' . trim($value));
    }

    $mail = new PHPMailer(true);
    try {
        // Gmail SMTP
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = getenv('GMAIL_USERNAME');           // <-- your Gmail
        $mail->Password   = getenv("GMAIL_PASSWORD");     // <-- app password
        // Either SMTPS 465 (recommended) or STARTTLS 587. Pick ONE:
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;     // implicit TLS
        $mail->Port       = 465;
        // $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS; // alt: STARTTLS
        // $mail->Port       = 587;

        // From/To
        $mail->setFrom(getenv('GMAIL_USERNAME'), 'Dorm Mart');
        $mail->addReplyTo(getenv('GMAIL_USERNAME'), 'Dorm Mart Support');
        $mail->addAddress($user['email'], trim(($user['firstName'] ?? '').' '.($user['lastName'] ?? '')));

        // Subject & Body
        $first = $user['firstName'] ?: 'Student';
        $subject = 'Welcome to Dorm Mart';
        $html = <<<HTML
<!doctype html><html><body style="font-family:Arial;line-height:1.5;color:#111;">
<p>Dear {$first},</p>
<p>Welcome to <strong>Dorm Mart</strong> — the student marketplace for UB.</p>
<p>Here is your temporary (current) password. <strong>DO NOT</strong> share this with anyone.</p>
<p style="font-size:18px;"><strong>{$tempPassword}</strong></p>
<p>If you want to change this password, go to <em>Settings → Change Password</em>.</p>
<p>Happy trading,<br/>The Dorm Mart Team</p>
<hr style="border:none;border-top:1px solid #ddd;margin:16px 0;">
<p style="font-size:12px;color:#555;">This is an automated message; do not reply. For support:
<a href="mailto:dormmartsupport@gmail.com">dormmartsupport@gmail.com</a></p>
</body></html>
HTML;

        $text = <<<TEXT
Dear {$first},

Welcome to Dorm Mart — the student marketplace for UB.

Here is your temporary (current) password. DO NOT share this with anyone.

** {$tempPassword} **

If you want to change this password, go to Settings -> Change Password.

Happy trading,
The Dorm Mart Team.

This is an automated message; do not reply. For support: dormmartsupport@gmail.com
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
  'ok' => true,
  'message' => 'If an account does not exist, a temporary password has been sent.',
  'email' => $email,
]);

} catch (Throwable $e) {
  // Log $e->getMessage() server-side
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>"There was an error"]);
}


