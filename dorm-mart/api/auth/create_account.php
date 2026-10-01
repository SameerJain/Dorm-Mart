<?php

require_once __DIR__ . '/../helpers/api_bootstrap.php';
init_json_endpoint('POST', ['ok' => false, 'error' => 'Method Not Allowed']);

require_once __DIR__ . '/auth_handle.php';
require_once __DIR__ . '/../config/app_config.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../helpers/email.php';

const ACCOUNT_REQUEST_ACCEPTED_MESSAGE = 'If eligible, account instructions will be sent.';
const TEMP_PASSWORD_LENGTH = 8;
$accountRequestStartedAt = microtime(true);

/** Every outcome answers identically after the same delay, so none reveals whether the email is eligible or taken. */
function accept_account_request(): void
{
    global $accountRequestStartedAt;
    json_response_after($accountRequestStartedAt, 2.0, [
        'ok' => true,
        'message' => ACCOUNT_REQUEST_ACCEPTED_MESSAGE,
    ], 202);
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


function generate_password(): string
{
    $length = TEMP_PASSWORD_LENGTH;

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

// Read the JSON body from React's fetch()
$data = json_request_body_or_error(['ok' => false, 'error' => 'Invalid JSON body']);

// Extract the values (before validation)
if (!is_string($data['firstName'] ?? null)
    || !is_string($data['lastName'] ?? null)
    || !is_string($data['email'] ?? null)) {
    json_response(['ok' => false, 'error' => 'Invalid input format'], 400);
}
$firstNameRaw = trim($data['firstName']);
$lastNameRaw = trim($data['lastName']);
$emailRaw = strtolower(trim($data['email']));
$requestId = bin2hex(random_bytes(8));

// Consume quota before inspecting the email so rate-limit behavior cannot reveal
// whether an address is registered, eligible, or deliverable.
$accountRateLimit = consume_account_creation_attempt();
if (!empty($accountRateLimit['unavailable'])) {
    dm_log_auth_event('create_account', $requestId, 'rate_limiter_unavailable');
    json_response(['ok' => false, 'error' => 'Account creation is temporarily unavailable. Please try again shortly.'], 503);
}
if ($accountRateLimit['blocked']) {
    $retryAfterSeconds = max(1, (int)$accountRateLimit['retry_after_seconds']);
    header('Retry-After: ' . $retryAfterSeconds);
    dm_log_auth_event('create_account', $requestId, 'rate_limited');
    json_response([
        'ok' => false,
        'error' => 'Too many account requests. Please try again in a few minutes.',
        'retry_after_seconds' => $retryAfterSeconds,
    ], 429);
}

// Load email policy configuration
require_once __DIR__ . '/../config/email_config.php';

// Input validation with regex patterns
$firstName = validate_input($firstNameRaw, 30, '/^[a-zA-Z\s\-]+$/');
$lastName = validate_input($lastNameRaw, 30, '/^[a-zA-Z\s\-]+$/');
$gradMonth = strict_integer_value($data['gradMonth'] ?? null);
$gradYear  = strict_integer_value($data['gradYear'] ?? null);
$promos = strict_boolean_value($data['promos'] ?? false);
$termsAccepted = strict_boolean_value($data['terms'] ?? null);

if ($gradMonth === null || $gradYear === null || $promos === null || $termsAccepted !== true) {
    json_response(['ok' => false, 'error' => $termsAccepted !== true
        ? 'You must agree to the terms'
        : 'Invalid input format'], 400);
}

// Email validation based on ALLOW_ALL_EMAILS flag
if (ALLOW_ALL_EMAILS) {
    // Accept any valid email format
    $email = validate_input($emailRaw, 255, '/^[^@\s]+@[^@\s]+\.[^@\s]+$/');
    if ($email === false || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        dm_log_auth_event('create_account', $requestId, 'ineligible_request');
        accept_account_request();
    }
} else {
    // Only accept @buffalo.edu
    $email = validate_input($emailRaw, 255, '/^[^@\s]+@buffalo\.edu$/');
    if ($email === false || !preg_match('/^[^@\s]+@buffalo\.edu$/', $email)) {
        dm_log_auth_event('create_account', $requestId, 'ineligible_request');
        accept_account_request();
    }
}

// The name pattern requires at least one character, so this also covers blank
// names; an invalid email was already answered above.
if ($firstName === false || $lastName === false) {
    json_response(['ok' => false, 'error' => 'Invalid input format'], 400);
}

$emailLocalPart = explode('@', $email)[0] ?? '';
if (preg_match('/^\d+$/', $emailLocalPart)) {
    dm_log_auth_event('create_account', $requestId, 'ineligible_request');
    accept_account_request();
}

// --- Validate graduation date format ---
if ($gradMonth < 1 || $gradMonth > 12 || $gradYear < 1900) {
    json_response(['ok' => false, 'error' => 'Invalid graduation date'], 400);
}

// --- Current and limit dates ---
$currentYear  = (int)date('Y');
$currentMonth = (int)date('n');
$maxFutureYear = $currentYear + 6;

// --- Check for past date ---
if ($gradYear < $currentYear || ($gradYear === $currentYear && $gradMonth < $currentMonth)) {
    json_response(['ok' => false, 'error' => 'Graduation date cannot be in the past'], 400);
}

// --- Check for excessive future date ---
if ($gradYear > $maxFutureYear || ($gradYear === $maxFutureYear && $gradMonth > $currentMonth)) {
    json_response(['ok' => false, 'error' => 'Graduation date cannot be more than 6 years in the future'], 400);
}

require_once __DIR__ . '/../database/db_connect.php';
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
    $tempPassword = generate_password();
    $hashPass     = hash_password($tempPassword);

    // 3) Insert user
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $sql = 'INSERT INTO user_accounts
          (first_name, last_name, grad_month, grad_year, email, promotional, promo_frequency, hash_pass, hash_auth, join_date, seller, theme, received_intro_promo_email)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, NULL, CURRENT_DATE, 0, 0, ?)';

    $ins = $conn->prepare($sql);
    /*
    types: s=string, i=int
    first_name(s), last_name(s), grad_month(i), grad_year(i),
    email(s), promotional(i), hash_pass(s), hash_auth(s), received_intro_promo_email(i)
*/
    $promotional = $promos ? 1 : 0;
    $promoFrequency = $promos ? 'weekly' : 'off';
    $receivedIntroPromoEmail = $promos ? 1 : 0; // Set to TRUE if promotional emails are enabled
    $ins->bind_param(
        'ssiisissi',
        $firstName,
        $lastName,
        $gradMonth,
        $gradYear,
        $email,
        $promotional,
        $promoFrequency,
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
        $emailResult = dm_send_email(
            ["firstName" => $firstName, "lastName" => $lastName, "email" => $email],
            dm_transactional_welcome_package($firstName, $tempPassword)
        );
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
