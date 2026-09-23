<?php
/**
 * Comprehensive Security Module
 * This file contains all security-related functions for the application
 * 
 * @author Team f25-no-brainers
 * @version 1.0
 */

require_once __DIR__ . '/../config/app_config.php';

// API failures belong in server logs, never in HTTP responses.
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('log_errors', '1');

// SECURITY HEADERS

/**
 * Set comprehensive security headers for all API endpoints
 * This function should be called at the start of every API endpoint
 */
function is_https_request(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

function security_csp_header(): string {
    return "default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' wss:; frame-ancestors 'none';";
}

function require_local_or_cli_access(): void {
    if (php_sapi_name() === 'cli') {
        return;
    }

    $host = (string)($_SERVER['HTTP_HOST'] ?? '');
    if (dm_is_local_host($host)) {
        return;
    }

    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Not found']);
    exit;
}

function dm_enforce_https(): void
{
    if (php_sapi_name() === 'cli') return;

    $host = (string)($_SERVER['HTTP_HOST'] ?? '');
    if (dm_is_local_host($host)) return;

    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';

    if ($isHttps) return;

    if ($host !== '' && dm_is_allowed_redirect_host($host)) {
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        header('Location: https://' . $host . $uri, true, 301);
        exit;
    }

    // Host not in allowlist — reject with 421 instead of silently dying
    http_response_code(421);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'HTTPS required']);
    exit;
}

function set_security_headers() {
    set_exception_handler(static function (Throwable $error): void {
        error_log('Unhandled API error: ' . $error->getMessage());
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
        }
        echo json_encode(['ok' => false, 'success' => false, 'error' => 'Server error']);
    });

    // Content Security Policy - unsafe-eval removed; production React bundles don't need it
    header('Content-Security-Policy: ' . security_csp_header());

    // X-Content-Type-Options - Prevents MIME type sniffing
    header("X-Content-Type-Options: nosniff");

    // X-Frame-Options - Prevents clickjacking (kept for older browser compat alongside frame-ancestors)
    header("X-Frame-Options: DENY");

    // Referrer Policy - Controls referrer information
    header("Referrer-Policy: strict-origin-when-cross-origin");

    // Permissions Policy - Controls browser features
    header("Permissions-Policy: geolocation=(), microphone=(), camera=()");

    header('Cross-Origin-Opener-Policy: same-origin');

    // HSTS - Force HTTPS for all future requests; only sent over HTTPS to avoid breaking HTTP
    if (is_https_request()) {
        header("Strict-Transport-Security: max-age=31536000; includeSubDomains");
    }

    // Remove X-Powered-By header to hide PHP version
    header_remove('X-Powered-By');
}

// CORS CONFIGURATION

/**
 * Set secure CORS headers for trusted origins only
 * This prevents unauthorized cross-origin requests
 */
function set_secure_cors() {
    // Skip CORS for CLI requests
    if (php_sapi_name() === 'cli') {
        return;
    }
    
    $origin = rtrim($_SERVER['HTTP_ORIGIN'] ?? '', '/');
    $allowedOrigins = dm_cors_allowed_origins();

    if ($origin === '') {
        $origin = dm_request_origin();
    }

    if ($origin === '' || !in_array($origin, $allowedOrigins, true)) {
        // Reject requests from untrusted origins
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'error' => 'Origin not allowed']);
        exit;
    }

    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept');
    header('Access-Control-Max-Age: 86400');
}

// INPUT SANITIZATION & VALIDATION

/**
 * Normalize string input before validation or storage.
 *
 * This helper trims, length-limits, removes null bytes, and preserves the
 * existing HTML entity behavior for current call sites. Prefer escape_html()
 * when encoding values specifically for HTML output.
 *
 * @param string $input The input string to sanitize
 * @param int $maxLength Maximum allowed length (default: 1000)
 * @return string Sanitized string
 */
function sanitize_string($input, $maxLength = 1000) {
    if (!is_string($input)) {
        return '';
    }
    
    // Trim whitespace
    $input = trim($input);
    
    // Limit length
    $input = substr($input, 0, $maxLength);
    
    // Remove null bytes
    $input = str_replace("\0", '', $input);
    
    // Keep existing behavior for callers that expect entity-encoded text.
    $input = htmlspecialchars($input, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    
    return $input;
}

/**
 * Sanitize email input
 * @param string $email Email to sanitize
 * @return string Sanitized email
 */
function sanitize_email($email) {
    if (!is_string($email)) {
        return '';
    }

    $email = strtolower(trim($email));

    // Enforce RFC 5321 length limit
    if (strlen($email) > 254) {
        return '';
    }

    // Remove null bytes
    $email = str_replace("\0", '', $email);

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return '';
    }

    return $email;
}

/**
 * Sanitize number input with min/max validation
 * @param mixed $input The input to sanitize
 * @param int $min Minimum allowed value
 * @param int $max Maximum allowed value
 * @return int Sanitized number
 */
function sanitize_number($input, $min = 0, $max = PHP_INT_MAX) {
    $number = (int) $input;
    return max($min, min($max, $number));
}

// UTILITY FUNCTIONS

/**
 * Escape values for HTML output.
 * 
 * Use this for HTML email templates and server-rendered HTML. Do not use it
 * for normal JSON API data that React renders as text.
 * 
 * @param string $str String to escape
 * @return string Escaped string with HTML entities
 */
function escape_html($str) {
    return htmlspecialchars($str ?? '', ENT_QUOTES, 'UTF-8');
}

/**
 * Validate input with custom rules.
 * @param string $input Input to validate
 * @param int $maxLength Maximum length allowed
 * @param string|null $allowedChars Regex pattern for allowed characters
 * @return string|false Validated input or false if invalid
 */
function validate_input($input, $maxLength = 255, $allowedChars = null) {
    $input = trim($input);
    if (strlen($input) > $maxLength) {
        return false;
    }
    if ($allowedChars && !preg_match($allowedChars, $input)) {
        return false;
    }
    return $input;
}

// RATE LIMITING FUNCTIONS

const ACCOUNT_CREATION_MAX_ATTEMPTS = 4;
const ACCOUNT_CREATION_ATTEMPT_WINDOW_MINUTES = 10;
const ACCOUNT_CREATION_LOCKOUT_MINUTES = 3;

/** Build an opaque account-creation key without using the submitted email. */
function account_creation_rate_limit_key(): string
{
    $forwarded = trim(explode(',', (string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''))[0]);
    $remote = trim((string)($_SERVER['REMOTE_ADDR'] ?? ''));
    $ip = filter_var($forwarded, FILTER_VALIDATE_IP)
        ? $forwarded
        : (filter_var($remote, FILTER_VALIDATE_IP) ? $remote : 'unknown');

    return hash('sha256', "account_creation\0" . $ip);
}

/** Atomically consume one account-creation attempt. */
function consume_account_creation_attempt(): array
{
    $conn = null;
    try {
        require_once __DIR__ . '/../database/db_connect.php';
        $conn = db();
        $rateLimitKey = account_creation_rate_limit_key();
        $conn->begin_transaction();

        $stmt = $conn->prepare(
            'INSERT IGNORE INTO account_creation_rate_limits
                (rate_limit_key, attempt_count, last_attempt_at, lockout_until)
             VALUES (?, 0, NULL, NULL)'
        );
        $stmt->bind_param('s', $rateLimitKey);
        $stmt->execute();
        $stmt->close();

        $stmt = $conn->prepare(
            'SELECT attempt_count, last_attempt_at, lockout_until,
                    GREATEST(0, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), lockout_until)) AS retry_after_seconds
             FROM account_creation_rate_limits
             WHERE rate_limit_key = ?
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

        $attempts = (int)($row['attempt_count'] ?? 0);
        $lastAttempt = $row['last_attempt_at'] ?? null;
        if (($row['lockout_until'] ?? null) !== null
            || $lastAttempt === null
            || strtotime((string)$lastAttempt) < time() - (ACCOUNT_CREATION_ATTEMPT_WINDOW_MINUTES * 60)) {
            $attempts = 0;
        }

        $attempts++;
        $startsLockout = $attempts >= ACCOUNT_CREATION_MAX_ATTEMPTS;
        $stmt = $conn->prepare(
            'UPDATE account_creation_rate_limits
             SET attempt_count = ?,
                 last_attempt_at = UTC_TIMESTAMP(),
                 lockout_until = CASE WHEN ? = 1
                    THEN DATE_ADD(UTC_TIMESTAMP(), INTERVAL 3 MINUTE)
                    ELSE NULL END
             WHERE rate_limit_key = ?'
        );
        $lock = $startsLockout ? 1 : 0;
        $stmt->bind_param('iis', $attempts, $lock, $rateLimitKey);
        $stmt->execute();
        $stmt->close();
        $conn->commit();
        $conn->close();

        return [
            'blocked' => false,
            'retry_after_seconds' => $startsLockout ? ACCOUNT_CREATION_LOCKOUT_MINUTES * 60 : 0,
        ];
    } catch (Throwable $e) {
        if ($conn instanceof mysqli) {
            try {
                $conn->rollback();
            } catch (Throwable $ignored) {
            }
            $conn->close();
        }
        error_log('account-creation rate-limit update failed: ' . $e->getMessage());
        return ['blocked' => false, 'retry_after_seconds' => 0];
    }
}

/** Build a stable, non-reversible key without storing an email address or raw IP. */
function login_rate_limit_key(string $normalizedEmail): string
{
    $ip = trim((string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    if (!filter_var($ip, FILTER_VALIDATE_IP)) {
        $ip = 'unknown';
    }

    return hash('sha256', strtolower(trim($normalizedEmail)) . "\0" . $ip);
}

const LOGIN_MAX_ATTEMPTS = 4;
const LOGIN_ATTEMPT_WINDOW_MINUTES = 10;
const LOGIN_LOCKOUT_MINUTES = 3;

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
 * @return array{blocked: bool, retry_after_seconds: int}
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
        return ['blocked' => false, 'retry_after_seconds' => 0];
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
    $retryAfterSeconds = max(1, (int)$limit['retry_after_seconds']);
    $minutes = rate_limit_retry_minutes($retryAfterSeconds);
    if (!headers_sent()) {
        header('Retry-After: ' . $retryAfterSeconds);
    }

    return [
        'ok' => false,
        'success' => false,
        'error' => "Too many incorrect password attempts. Please try again in {$minutes} minute"
            . ($minutes > 1 ? 's' : '') . '.',
    ];
}

/** Check the fixed ten-minute failure window and three-minute lockout. */
function check_rate_limit(string $rateLimitKey): array
{
    try {
        require_once __DIR__ . '/../database/db_connect.php';
        $conn = db();
        $stmt = $conn->prepare(
            'SELECT failed_login_attempts, lockout_until,
                    lockout_until > UTC_TIMESTAMP() AS is_blocked,
                    last_failed_attempt < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE) AS window_expired
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
                    OR last_failed_attempt < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))'
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

// PASSWORD SECURITY

/**
 * Hash password securely using bcrypt
 * @param string $password Plain text password
 * @return string Hashed password
 */
function hash_password($password) {
    require_once __DIR__ . '/../utility/hash_password.php';
    return password_hash($password, PASSWORD_BCRYPT);
}

// INITIALIZATION

/**
 * Initialize security for API endpoints
 * Call this function at the start of every API endpoint
 */
function init_security() {
    set_security_headers();
    set_secure_cors();
}

?>
