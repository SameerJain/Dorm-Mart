<?php
/**
 * Comprehensive Security Module
 * This file contains all security-related functions for the application
 * 
 * @author Team f25-no-brainers
 * @version 1.0
 */

require_once __DIR__ . '/../config/app_config.php';

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
    return "default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' wss:; frame-ancestors 'none';";
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

/** Build a stable, non-reversible key without storing an email address or raw IP. */
function login_rate_limit_key(string $normalizedEmail): string
{
    $ip = trim((string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    if (!filter_var($ip, FILTER_VALIDATE_IP)) {
        $ip = 'unknown';
    }

    return hash('sha256', strtolower(trim($normalizedEmail)) . "\0" . $ip);
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

/** Increment the counter atomically so concurrent failures cannot be lost. */
function record_failed_attempt(string $rateLimitKey): void
{
    try {
        require_once __DIR__ . '/../database/db_connect.php';
        $conn = db();
        $stmt = $conn->prepare(
            'INSERT IGNORE INTO login_rate_limits
                (session_id, failed_login_attempts, last_failed_attempt, lockout_until)
             VALUES (?, 0, NULL, NULL)'
        );
        $stmt->bind_param('s', $rateLimitKey);
        $stmt->execute();
        $stmt->close();

        $stmt = $conn->prepare(
            'UPDATE login_rate_limits
             SET lockout_until = CASE
                     WHEN lockout_until > UTC_TIMESTAMP() THEN lockout_until
                     WHEN last_failed_attempt IS NULL
                       OR last_failed_attempt < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE) THEN NULL
                     WHEN failed_login_attempts + 1 >= 4 THEN DATE_ADD(UTC_TIMESTAMP(), INTERVAL 3 MINUTE)
                     ELSE NULL
                 END,
                 failed_login_attempts = CASE
                     WHEN last_failed_attempt IS NULL
                       OR last_failed_attempt < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE) THEN 1
                     ELSE failed_login_attempts + 1
                 END,
                 last_failed_attempt = UTC_TIMESTAMP()
             WHERE session_id = ?'
        );
        $stmt->bind_param('s', $rateLimitKey);
        $stmt->execute();
        $stmt->close();
        $conn->close();
    } catch (Throwable $e) {
        error_log('login rate-limit update failed: ' . $e->getMessage());
    }
}

function reset_failed_attempts(string $rateLimitKey): void
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
