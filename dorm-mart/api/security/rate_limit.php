<?php
// Attempt throttling: login, account creation, password confirmation, Turnstile.
// Endpoints load this through security.php.
require_once __DIR__ . '/../config/app_config.php';

// RATE LIMITING FUNCTIONS

const ACCOUNT_CREATION_MAX_ATTEMPTS = 4;
const ACCOUNT_CREATION_ATTEMPT_WINDOW_MINUTES = 10;
const ACCOUNT_CREATION_LOCKOUT_MINUTES = 3;

/** Retry-After quoted when the limiter itself is unavailable and refuses the attempt. */
const RATE_LIMIT_FAILURE_RETRY_SECONDS = 60;

/**
 * Resolve the client IP that rate-limit keys are bucketed by.
 *
 * REMOTE_ADDR is useless behind Railway's edge: each request is proxied by a
 * different node (100.64.0.1-19 in production), so a key built from it lands in
 * a fresh bucket every time and no counter ever accumulates. X-Forwarded-For
 * carries the actual client, so prefer it, keeping REMOTE_ADDR as the fallback
 * for local runs with no proxy in front.
 *
 * Railway's edge APPENDS the connecting address to X-Forwarded-For, so only the
 * LAST entry was written by our proxy. Anything before it arrived in the
 * client's own request and is forgeable; trusting the first entry let a client
 * pick a fresh bucket per request and defeat the limiter entirely.
 */
function rate_limit_client_ip(): string
{
    $chain = array_map('trim', explode(',', (string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? '')));
    $forwarded = (string)end($chain);
    $remote = trim((string)($_SERVER['REMOTE_ADDR'] ?? ''));

    return filter_var($forwarded, FILTER_VALIDATE_IP)
        ? $forwarded
        : (filter_var($remote, FILTER_VALIDATE_IP) ? $remote : 'unknown');
}

/** Build an opaque account-creation key without using the submitted email. */
function account_creation_rate_limit_key(): string
{
    return hash('sha256', "account_creation\0" . rate_limit_client_ip());
}

/**
 * Atomically consume one account-creation attempt. Shares the generic
 * throttle table; the key is namespaced so it never meets a login bucket.
 */
function consume_account_creation_attempt(): array
{
    return consume_rate_limit(
        account_creation_rate_limit_key(),
        ACCOUNT_CREATION_MAX_ATTEMPTS,
        ACCOUNT_CREATION_ATTEMPT_WINDOW_MINUTES,
        ACCOUNT_CREATION_LOCKOUT_MINUTES
    );
}

/** Build a stable, non-reversible key without storing an email address or raw IP. */
function login_rate_limit_key(string $normalizedEmail): string
{
    return hash('sha256', strtolower(trim($normalizedEmail)) . "\0" . rate_limit_client_ip());
}

/** Count login attempts from one client across every email it tries. */
function login_client_rate_limit_key(): string
{
    return hash('sha256', "login_client\0" . rate_limit_client_ip());
}

const LOGIN_MAX_ATTEMPTS = 4;
const LOGIN_ATTEMPT_WINDOW_MINUTES = 10;
const LOGIN_LOCKOUT_MINUTES = 3;

// With Turnstile configured, crossing either threshold asks for a human check
// instead of refusing the login, so nobody sharing an IP (campus NAT, VPN)
// can lock the others out by burning attempts.
const LOGIN_FREE_ATTEMPTS_PER_ACCOUNT = 3;
const LOGIN_FREE_ATTEMPTS_PER_CLIENT = 10;

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_MAX_TOKEN_LENGTH = 2048;

/** Site key the login form renders the Turnstile widget with; '' when unconfigured. */
function turnstile_site_key(): string
{
    return dm_env_string('TURNSTILE_SITE_KEY');
}

function turnstile_enabled(): bool
{
    return turnstile_site_key() !== '' && dm_env_string('TURNSTILE_SECRET_KEY') !== '';
}

/**
 * Ask Cloudflare whether a Turnstile token is genuine and unspent. Tokens are
 * single-use, so each attempt past the free allowance costs a fresh solve.
 * Any failure to reach Cloudflare counts as unverified.
 */
function verify_turnstile_token(string $token): bool
{
    if ($token === '' || strlen($token) > TURNSTILE_MAX_TOKEN_LENGTH || !function_exists('curl_init')) {
        return false;
    }

    $fields = [
        'secret' => dm_env_string('TURNSTILE_SECRET_KEY'),
        'response' => $token,
    ];
    $ip = rate_limit_client_ip();
    if ($ip !== 'unknown') {
        $fields['remoteip'] = $ip;
    }

    $curl = curl_init(TURNSTILE_VERIFY_URL);
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POSTFIELDS => http_build_query($fields),
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 10,
    ]);
    $body = curl_exec($curl);
    $status = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);

    $result = is_string($body) ? json_decode($body, true) : null;
    if ($status !== 200 || !is_array($result)) {
        error_log("Turnstile siteverify failed: HTTP {$status}");
        return false;
    }
    return ($result['success'] ?? false) === true;
}

/**
 * Claim one login attempt against both throttle buckets and decide whether it
 * may go on to the password check.
 *
 * - per email+IP: guessing one account's password
 * - per IP only: one client cycling through many emails (password spraying)
 *
 * Without Turnstile configured this falls back to the hard lockout on the
 * email+IP bucket alone; a hard lockout per IP would let one person on a
 * shared network lock out everyone behind it.
 *
 * 'unavailable' means the limiter's storage failed; the attempt is refused.
 *
 * @return array{outcome: 'allowed'|'challenge'|'blocked'|'unavailable', retry_after_seconds: int, account_key: string}
 */
function claim_login_attempt(string $normalizedEmail, string $turnstileToken): array
{
    $accountKey = login_rate_limit_key($normalizedEmail);

    if (!turnstile_enabled()) {
        $limit = consume_login_attempt($accountKey);
        return [
            'outcome' => !empty($limit['unavailable']) ? 'unavailable' : ($limit['blocked'] ? 'blocked' : 'allowed'),
            'retry_after_seconds' => (int)$limit['retry_after_seconds'],
            'account_key' => $accountKey,
        ];
    }

    // PHP_INT_MAX: these buckets only count; crossing a threshold never locks.
    $account = consume_rate_limit($accountKey, PHP_INT_MAX, LOGIN_ATTEMPT_WINDOW_MINUTES, 1);
    $client = consume_rate_limit(login_client_rate_limit_key(), PHP_INT_MAX, LOGIN_ATTEMPT_WINDOW_MINUTES, 1);
    if ($account['blocked'] || $client['blocked']) {
        // Storage failure, or a lockout left over from before Turnstile was on.
        return [
            'outcome' => !empty($account['unavailable']) || !empty($client['unavailable']) ? 'unavailable' : 'blocked',
            'retry_after_seconds' => max((int)$account['retry_after_seconds'], (int)$client['retry_after_seconds']),
            'account_key' => $accountKey,
        ];
    }

    $needsChallenge = $account['attempts'] > LOGIN_FREE_ATTEMPTS_PER_ACCOUNT
        || $client['attempts'] > LOGIN_FREE_ATTEMPTS_PER_CLIENT;

    return [
        'outcome' => $needsChallenge && !verify_turnstile_token($turnstileToken) ? 'challenge' : 'allowed',
        'retry_after_seconds' => 0,
        'account_key' => $accountKey,
    ];
}

/**
 * Settle the throttle buckets after a correct password. The account bucket is
 * cleared outright; the client bucket only gets this attempt back, so it ends
 * up counting failures. Clearing it would let an attacker reset their IP's
 * count by logging into an account of their own between guesses.
 */
function settle_successful_login(string $accountKey): void
{
    clear_rate_limit($accountKey);

    if (!turnstile_enabled()) {
        return;
    }
    require_once __DIR__ . '/../database/db_connect.php';
    $conn = db();
    $clientKey = login_client_rate_limit_key();
    $stmt = $conn->prepare(
        'UPDATE login_rate_limits
         SET failed_login_attempts = GREATEST(failed_login_attempts - 1, 0)
         WHERE session_id = ?'
    );
    $stmt->bind_param('s', $clientKey);
    $stmt->execute();
    $stmt->close();
    $conn->close();
}

/** Namespace a per-user limiter so it cannot collide with a login key. */
function scoped_rate_limit_key(string $scope, int $userId): string
{
    return hash('sha256', $scope . "\0" . $userId);
}

/**
 * Atomically claim one attempt against a throttle bucket.
 *
 * Read-then-write throttles lose concurrent requests: several callers all see
 * the pre-lockout count, all pass, and all proceed. Taking the row with
 * FOR UPDATE inside a transaction serializes competing requests so the cap
 * holds no matter how many arrive at once.
 *
 * Window and lockout comparisons stay in SQL so a PHP timezone that differs
 * from the database's cannot shift the boundaries.
 *
 * @return array{blocked: bool, retry_after_seconds: int, attempts?: int, unavailable?: bool}
 *   `attempts` is this claim's position in the current window, present
 *   whenever the attempt was not blocked. `unavailable` is set when the
 *   limiter's storage failed and the attempt was refused for that reason.
 */
function consume_rate_limit(
    string $rateLimitKey,
    int $maxAttempts,
    int $windowMinutes,
    int $lockoutMinutes
): array {
    $windowMinutes = max(1, $windowMinutes);
    $lockoutMinutes = max(1, $lockoutMinutes);
    $conn = null;

    try {
        require_once __DIR__ . '/../database/db_connect.php';
        $conn = db();
        $conn->begin_transaction();

        $stmt = $conn->prepare(
            'INSERT IGNORE INTO login_rate_limits
                (session_id, failed_login_attempts, last_failed_attempt, lockout_until)
             VALUES (?, 0, NULL, NULL)'
        );
        $stmt->bind_param('s', $rateLimitKey);
        $stmt->execute();
        $stmt->close();

        $stmt = $conn->prepare(
            'SELECT failed_login_attempts, lockout_until,
                    GREATEST(0, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), lockout_until)) AS retry_after_seconds,
                    (last_failed_attempt IS NULL
                     OR last_failed_attempt < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ' . $windowMinutes . ' MINUTE)) AS window_expired
             FROM login_rate_limits
             WHERE session_id = ?
             FOR UPDATE'
        );
        $stmt->bind_param('s', $rateLimitKey);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $retryAfterSeconds = (int)($row['retry_after_seconds'] ?? 0);
        if ($retryAfterSeconds > 0) {
            $conn->commit();
            $conn->close();
            return ['blocked' => true, 'retry_after_seconds' => $retryAfterSeconds];
        }

        // A stale window, or a lockout that has since elapsed, both start over.
        $attempts = (int)($row['failed_login_attempts'] ?? 0);
        if ((int)($row['window_expired'] ?? 1) === 1 || ($row['lockout_until'] ?? null) !== null) {
            $attempts = 0;
        }

        $attempts++;
        $startsLockout = $attempts >= $maxAttempts;
        $stmt = $conn->prepare(
            'UPDATE login_rate_limits
             SET failed_login_attempts = ?,
                 last_failed_attempt = UTC_TIMESTAMP(),
                 lockout_until = CASE WHEN ? = 1
                    THEN DATE_ADD(UTC_TIMESTAMP(), INTERVAL ' . $lockoutMinutes . ' MINUTE)
                    ELSE NULL END
             WHERE session_id = ?'
        );
        $lock = $startsLockout ? 1 : 0;
        $stmt->bind_param('iis', $attempts, $lock, $rateLimitKey);
        $stmt->execute();
        $stmt->close();
        $conn->commit();
        $conn->close();

        return [
            'blocked' => false,
            'retry_after_seconds' => $startsLockout ? $lockoutMinutes * 60 : 0,
            'attempts' => $attempts,
        ];
    } catch (Throwable $e) {
        if ($conn instanceof mysqli) {
            try {
                $conn->rollback();
            } catch (Throwable $ignored) {
            }
            $conn->close();
        }
        error_log('rate-limit consume failed: ' . $e->getMessage());
        // Fail closed: a limiter that cannot record attempts must not wave them
        // through, or a storage fault silently removes brute-force protection.
        // `unavailable` lets callers say "try again shortly" rather than blame
        // the user for attempts they never made.
        return [
            'blocked' => true,
            'retry_after_seconds' => RATE_LIMIT_FAILURE_RETRY_SECONDS,
            'unavailable' => true,
        ];
    }
}

/** Claim one login attempt. Successful logins clear the bucket afterwards. */
function consume_login_attempt(string $rateLimitKey): array
{
    return consume_rate_limit(
        $rateLimitKey,
        LOGIN_MAX_ATTEMPTS,
        LOGIN_ATTEMPT_WINDOW_MINUTES,
        LOGIN_LOCKOUT_MINUTES
    );
}

/** Render a retry delay as the whole minutes an error message should quote. */
function rate_limit_retry_minutes(int $retryAfterSeconds): int
{
    return max(1, (int)ceil(max(1, $retryAfterSeconds) / 60));
}

/**
 * Send Retry-After and build the user-facing throttle message, e.g.
 * "Too many failed attempts. Please try again in 3 minutes."
 */
function rate_limit_retry_message(string $reason, int $retryAfterSeconds): string
{
    $retryAfterSeconds = max(1, $retryAfterSeconds);
    if (!headers_sent()) {
        header('Retry-After: ' . $retryAfterSeconds);
    }
    $minutes = rate_limit_retry_minutes($retryAfterSeconds);
    return "{$reason} Please try again in {$minutes} minute" . ($minutes > 1 ? 's' : '') . '.';
}

// Re-confirming a password from inside an authenticated session — disabling 2FA,
// changing the password, deleting the account — is still a password oracle, and
// someone on a hijacked session or an unattended device can work it. Throttle it
// like the login form.
const PASSWORD_CONFIRM_MAX_ATTEMPTS = 5;
const PASSWORD_CONFIRM_WINDOW_MINUTES = 10;
const PASSWORD_CONFIRM_LOCKOUT_MINUTES = 5;

function consume_password_confirm_attempt(int $userId): array
{
    return consume_rate_limit(
        scoped_rate_limit_key('password_confirm', $userId),
        PASSWORD_CONFIRM_MAX_ATTEMPTS,
        PASSWORD_CONFIRM_WINDOW_MINUTES,
        PASSWORD_CONFIRM_LOCKOUT_MINUTES
    );
}

function clear_password_confirm_attempts(int $userId): void
{
    clear_rate_limit(scoped_rate_limit_key('password_confirm', $userId));
}

/** Shared 429 body for a throttled password confirmation. */
function password_confirm_retry_error(array $limit): array
{
    return [
        'ok' => false,
        'success' => false,
        'error' => rate_limit_retry_message(
            'Too many incorrect password attempts.',
            (int)$limit['retry_after_seconds']
        ),
    ];
}

/**
 * Read-only view of a login bucket for the local rate-limit dashboards.
 * Uses the same window as consume_login_attempt() so the two cannot disagree.
 */
function check_rate_limit(string $rateLimitKey): array
{
    $window = (int)LOGIN_ATTEMPT_WINDOW_MINUTES;
    try {
        require_once __DIR__ . '/../database/db_connect.php';
        $conn = db();
        $stmt = $conn->prepare(
            'SELECT failed_login_attempts, lockout_until,
                    lockout_until > UTC_TIMESTAMP() AS is_blocked,
                    last_failed_attempt < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ' . $window . ' MINUTE) AS window_expired
             FROM login_rate_limits
             WHERE session_id = ?
             LIMIT 1'
        );
        $stmt->bind_param('s', $rateLimitKey);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$row) {
            $conn->close();
            return ['blocked' => false, 'attempts' => 0, 'lockout_until' => null];
        }

        if ((int)$row['is_blocked'] === 1) {
            $conn->close();
            return [
                'blocked' => true,
                'attempts' => (int)$row['failed_login_attempts'],
                'lockout_until' => $row['lockout_until'],
            ];
        }

        if ((int)$row['window_expired'] === 1 || $row['lockout_until'] !== null) {
            $reset = $conn->prepare(
                'UPDATE login_rate_limits
                 SET failed_login_attempts = 0, last_failed_attempt = NULL, lockout_until = NULL
                 WHERE session_id = ? AND (lockout_until <= UTC_TIMESTAMP()
                    OR last_failed_attempt < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ' . $window . ' MINUTE))'
            );
            $reset->bind_param('s', $rateLimitKey);
            $reset->execute();
            $reset->close();
            $conn->close();
            return ['blocked' => false, 'attempts' => 0, 'lockout_until' => null];
        }

        $conn->close();
        return [
            'blocked' => false,
            'attempts' => (int)$row['failed_login_attempts'],
            'lockout_until' => null,
        ];
    } catch (Throwable $e) {
        error_log('login rate-limit check failed: ' . $e->getMessage());
        return ['blocked' => false, 'attempts' => 0, 'lockout_until' => null];
    }
}

/** Drop a throttle bucket entirely, e.g. after the caller proves who they are. */
function clear_rate_limit(string $rateLimitKey): void
{
    require_once __DIR__ . '/../database/db_connect.php';
    $conn = db();
    $stmt = $conn->prepare('DELETE FROM login_rate_limits WHERE session_id = ?');
    $stmt->bind_param('s', $rateLimitKey);
    $stmt->execute();
    $stmt->close();
    $conn->close();
}


/**
 * Get remaining lockout minutes
 * @param string $lockoutUntil Lockout end time
 * @return int Remaining minutes
 */
function get_remaining_lockout_minutes($lockoutUntil) {
    if (empty($lockoutUntil)) {
        return 0;
    }
    
    // Use MySQL to calculate remaining time to avoid timezone issues
    require_once __DIR__ . '/../database/db_connect.php';
    $conn = db();
    $stmt = $conn->prepare("SELECT TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), ?) as remaining_seconds");
    $stmt->bind_param('s', $lockoutUntil);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    $conn->close();
    
    $remainingSeconds = (int)$row['remaining_seconds'];
    return max(0, ceil($remainingSeconds / 60));
}

