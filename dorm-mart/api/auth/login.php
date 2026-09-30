<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
init_json_endpoint('POST', ['ok' => false, 'error' => 'Method Not Allowed']);

require_once __DIR__ . '/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/two_factor.php';
require_once __DIR__ . '/../helpers/request.php';

// Initialize session for rate limiting (must be done before checking rate limits)
auth_boot_session();

$ct = $_SERVER['CONTENT_TYPE'] ?? '';
if (strpos($ct, 'application/json') !== false) {
    $data = json_request_body_or_error(['ok' => false, 'error' => 'Invalid JSON format']);
} else {
    $data = $_POST;
}
if (!is_string($data['email'] ?? null) || !is_string($data['password'] ?? null)) {
    json_response(['ok' => false, 'error' => 'Invalid credentials format'], 400);
}
$emailRaw = strtolower(trim($data['email']));
$passwordRaw = $data['password'];
$turnstileToken = $data['turnstile_token'] ?? '';
$turnstileToken = is_string($turnstileToken) ? trim($turnstileToken) : '';

// Accept any valid email format (to support existing non-UB accounts)
$email = validate_input($emailRaw, 255, '/^[^@\s]+@[^@\s]+\.[^@\s]+$/');
$password = strlen($passwordRaw) <= 64 ? $passwordRaw : false;

if ($email === false || $password === false) {
    $msg = $email === false ? 'Invalid email format' : 'Invalid password format. Please check your password.';
    json_response(['ok' => false, 'error' => $msg], 400);
}

// The pattern above already rejects an empty email.
if ($password === '') {
    json_response(['ok' => false, 'error' => 'Missing required fields'], 400);
}
// Validate email format using PHP's built-in validator
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(['ok' => false, 'error' => 'Invalid email format'], 400);
}

try {
    // CRITICAL: claim the attempt FIRST, before any password verification, so the
    // lockout applies whether or not the submitted credentials happen to be valid.
    // Claiming (rather than checking, then recording a failure later) is what makes
    // this safe under concurrency: parallel submissions cannot all read the same
    // pre-lockout count and slip through together. A correct password settles the
    // buckets below, so this never penalizes a legitimate login.
    $rateLimit = claim_login_attempt($email, $turnstileToken);
    $rateLimitKey = $rateLimit['account_key'];
    // Audit trail for failed and throttled logins (OWASP A09). The email is
    // hashed with the client IP (the rate-limit key) so the log can correlate
    // repeated attempts without storing addresses or raw IPs.
    $loginRequestId = bin2hex(random_bytes(8));
    $logLoginOutcome = static function (string $event, array $context = []) use ($loginRequestId, $rateLimitKey): void {
        dm_log_auth_event('login', $loginRequestId, $event, $context + ['attempt_key' => substr($rateLimitKey, 0, 16)]);
    };
    if ($rateLimit['outcome'] !== 'allowed') {
        $logLoginOutcome('attempt_' . $rateLimit['outcome']);
    }
    if ($rateLimit['outcome'] === 'challenge') {
        // Past the free attempts: a solved Turnstile check is required before the
        // password is even looked at, so the check cannot be skipped by a guess.
        json_response([
            'ok' => false,
            'requires_captcha' => true,
            'captcha_site_key' => turnstile_site_key(),
            'error' => $turnstileToken === ''
                ? 'Too many attempts. Please complete the verification check, then log in again.'
                : 'Verification check failed. Please try it again.',
        ], 403);
    }
    if ($rateLimit['outcome'] === 'unavailable') {
        json_response(['ok' => false, 'error' => 'Login is temporarily unavailable. Please try again shortly.'], 503);
    }
    if ($rateLimit['outcome'] === 'blocked') {
        json_response([
            'ok' => false,
            'error' => rate_limit_retry_message('Too many failed attempts.', (int)$rateLimit['retry_after_seconds']),
        ], 429);
    }

    $conn = db();
    
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $stmt = $conn->prepare(
        'SELECT user_id, first_name, last_name, email, hash_pass, theme, two_factor_enabled, role, is_banned, auth_version
         FROM user_accounts WHERE email = ? LIMIT 1'
    );
    $stmt->bind_param('s', $email);  // 's' = string type, $email is safely bound as parameter
    $stmt->execute();
    $res = $stmt->get_result();

    if ($res->num_rows === 0) {
        $stmt->close();
        $conn->close();
        // Spend the same bcrypt time as a real check, so response timing does
        // not reveal which emails have accounts (forgot_password hides it too).
        password_verify($password, '$2y$12$' . str_repeat('a', 53));

        $logLoginOutcome('failed_unknown_account');
        json_response(['ok' => false, 'error' => 'Invalid credentials'], 401);
    }
    $row = $res->fetch_assoc();
    $stmt->close();

    // SECURITY NOTE: password_verify() safely checks the submitted password.
    if (!password_verify($password, (string)$row['hash_pass'])) {
        $conn->close();
        $logLoginOutcome('failed_password', ['user_id' => (int)$row['user_id']]);
        json_response(['ok' => false, 'error' => 'Invalid credentials'], 401);
    }

    $userId = (int)$row['user_id'];

    if (!empty($row['is_banned'])) {
        $conn->close();
        json_response(['ok' => false, 'error' => 'Account suspended'], 403);
    }

    $conn->close();

    // Clear rate limiting data on successful login BEFORE regenerating session ID
    // This prevents the new session from inheriting any lockout state
    settle_successful_login($rateLimitKey);

    $theme = 'light'; // default
    if (isset($row['theme'])) {
        $theme = $row['theme'] ? 'dark' : 'light';
    }

    if (!empty($row['two_factor_enabled'])) {
        // Each login mints a fresh code and emails it, and a fresh code resets the
        // per-challenge guess counter. Without a cap on issuance, someone holding
        // the password gets unlimited rounds of guesses at the code and can flood
        // the account owner's inbox, so throttle how often a challenge can be sent.
        [$clientKey, $accountKey] = two_factor_issue_keys($userId);
        $challengeLimit = consume_rate_limit(
            $clientKey,
            TWO_FACTOR_MAX_CHALLENGES,
            TWO_FACTOR_CHALLENGE_WINDOW_MINUTES,
            TWO_FACTOR_CHALLENGE_LOCKOUT_MINUTES
        );
        if (!$challengeLimit['blocked']) {
            $challengeLimit = consume_rate_limit(
                $accountKey,
                TWO_FACTOR_MAX_CHALLENGES_PER_ACCOUNT,
                TWO_FACTOR_ACCOUNT_WINDOW_MINUTES,
                TWO_FACTOR_CHALLENGE_LOCKOUT_MINUTES
            );
        }
        if ($challengeLimit['blocked']) {
            json_response([
                'ok' => false,
                'error' => rate_limit_retry_message(
                    'Too many verification codes requested.',
                    (int)$challengeLimit['retry_after_seconds']
                ),
            ], 429);
        }

        regenerate_session_on_login();
        unset($_SESSION['user_id']);
        // Drop only this browser's cookie. Clearing the stored token here let a
        // correct password alone sign the owner's remembered device out before
        // the code was ever checked; verify_two_factor.php issues a new one.
        clear_remember_cookie();

        $code = create_two_factor_challenge($userId, $theme);
        $emailResult = send_two_factor_email(
            $row,
            dm_transactional_two_factor_code_package((string)$row['first_name'], $code)
        );
        if (!$emailResult['ok']) {
            clear_two_factor_challenge();
            error_log('Two-factor login email failed for user_id ' . $userId . ': ' . ($emailResult['error'] ?? 'unknown error'));
            json_response(['ok' => false, 'error' => 'Unable to send a verification code. Please try again.'], 503);
        }

        json_response([
            'ok' => true,
            'requires_two_factor' => true,
            'email' => mask_two_factor_email((string)$row['email']),
        ]);
    }

    // Regenerate session ID to prevent session fixation attacks
    // This happens AFTER clearing rate limits to ensure old session data is cleared
    regenerate_session_on_login();
    $_SESSION['user_id'] = $userId;
    $_SESSION['auth_version'] = (int)$row['auth_version'];
    notify_new_login_device($userId);
    record_login_device($userId);

    // Persist across restarts
    issue_remember_cookie($userId);

    json_response(['ok' => true, 'theme' => $theme, 'role' => $row['role'] ?? 'user']);
} catch (Throwable $e) {
    error_log('login error: ' . $e->getMessage());
    json_response(['ok' => false, 'error' => 'Server error'], 500);
}
