<?php
/**
 * Comprehensive Security Module
 * This file contains all security-related functions for the application
 * 
 * @author Team f25-no-brainers
 * @version 1.0
 */

// ============================================================================
// SECURITY HEADERS
// ============================================================================

/**
 * Set comprehensive security headers for all API endpoints
 * This function should be called at the start of every API endpoint
 */
function setSecurityHeaders() {
    // Content Security Policy - Prevents XSS by controlling resource loading
    header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none';");
    
    // X-XSS-Protection - Enables browser's built-in XSS filter
    header("X-XSS-Protection: 1; mode=block");
    
    // X-Content-Type-Options - Prevents MIME type sniffing
    header("X-Content-Type-Options: nosniff");
    
    // X-Frame-Options - Prevents clickjacking
    header("X-Frame-Options: DENY");
    
    // Referrer Policy - Controls referrer information
    header("Referrer-Policy: strict-origin-when-cross-origin");
    
    // Permissions Policy - Controls browser features
    header("Permissions-Policy: geolocation=(), microphone=(), camera=()");
    
    // Remove X-Powered-By header to hide PHP version
    header_remove('X-Powered-By');
}

// ============================================================================
// CORS CONFIGURATION
// ============================================================================

/**
 * Set secure CORS headers for trusted origins only
 * This prevents unauthorized cross-origin requests
 */
function setSecureCORS() {
    // SECURE CORS Configuration - Only allow specific trusted origins
    $allowedOrigins = [
        'http://localhost:3000',      // React dev server
        'http://localhost:8080',      // PHP dev server
        'http://localhost',           // Apache local setup
        'https://aptitude.cse.buffalo.edu',  // Test server
        'https://cattle.cse.buffalo.edu'    // Production server
    ];
    
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    
    // Only allow exact matches from our trusted origins list
    if (in_array($origin, $allowedOrigins)) {
        header("Access-Control-Allow-Origin: $origin");
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    } else {
        // Reject requests from untrusted origins
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'Origin not allowed']);
        exit;
    }
}

// ============================================================================
// INPUT SANITIZATION & VALIDATION
// ============================================================================

/**
 * Sanitize string input to prevent XSS attacks
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
    
    // HTML encode special characters to prevent XSS
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
    
    // Convert to lowercase and trim
    $email = strtolower(trim($email));
    
    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return '';
    }
    
    // Additional sanitization
    $email = sanitize_string($email, 254); // RFC 5321 limit
    
    return $email;
}

/**
 * Sanitize JSON input
 * @param string $json JSON string to sanitize
 * @return array|false Sanitized array or false if invalid
 */
function sanitize_json($json) {
    if (!is_string($json)) {
        return false;
    }
    
    // Decode JSON
    $data = json_decode($json, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        return false;
    }
    
    // Recursively sanitize all string values
    $data = sanitize_array($data);
    
    return $data;
}

/**
 * Recursively sanitize array values
 * @param array $data Array to sanitize
 * @return array Sanitized array
 */
function sanitize_array($data) {
    if (!is_array($data)) {
        return sanitize_string($data);
    }
    
    $sanitized = [];
    foreach ($data as $key => $value) {
        $sanitizedKey = sanitize_string($key, 100);
        $sanitizedValue = is_array($value) ? sanitize_array($value) : sanitize_string($value);
        $sanitized[$sanitizedKey] = $sanitizedValue;
    }
    
    return $sanitized;
}

// ============================================================================
// ACCESS CONTROL
// ============================================================================

/**
 * Validate user access to prevent IDOR attacks
 * @param int $requestedUserId The user ID being requested
 * @param int $loggedInUserId The currently logged in user ID
 */
function validateUserAccess($requestedUserId, $loggedInUserId) {
    // IDOR Protection - Ensure user can only access their own data
    if ($requestedUserId != $loggedInUserId) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'Permission denied - cannot access other user data']);
        exit;
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Escape HTML output to prevent XSS
 * @param string $str String to escape
 * @return string Escaped string
 */
function escapeHtml($str) {
    return htmlspecialchars($str ?? '', ENT_QUOTES, 'UTF-8');
}

/**
 * Escape JSON output to prevent XSS
 * @param string $str String to escape
 * @return string Escaped JSON string
 */
function escapeJson($str) {
    return json_encode($str ?? '', JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP);
}

/**
 * Validate input with custom rules
 * @param string $input Input to validate
 * @param int $maxLength Maximum length allowed
 * @param string|null $allowedChars Regex pattern for allowed characters
 * @return string|false Validated input or false if invalid
 */
function validateInput($input, $maxLength = 255, $allowedChars = null) {
    $input = trim($input);
    if (strlen($input) > $maxLength) {
        return false;
    }
    if ($allowedChars && !preg_match($allowedChars, $input)) {
        return false;
    }
    return $input;
}

// ============================================================================
// RATE LIMITING FUNCTIONS
// ============================================================================

/**
 * Check if user has exceeded rate limit for forgot password requests
 * @param string $email User's email address
 * @return array Rate limit status
 */
function check_rate_limit($email) {
    require_once __DIR__ . '/../utility/manage_forgot_password_rate_limiting.php';
    return check_forgot_password_rate_limit($email);
}

/**
 * Record a failed login attempt for rate limiting
 * @param string $email User's email address
 */
function record_failed_attempt($email) {
    require_once __DIR__ . '/../utility/manage_forgot_password_rate_limiting.php';
    record_failed_login_attempt($email);
}

/**
 * Reset failed login attempts for a user
 * @param string $email User's email address
 */
function reset_failed_attempts($email) {
    require_once __DIR__ . '/../utility/manage_forgot_password_rate_limiting.php';
    reset_failed_login_attempts($email);
}

/**
 * Get remaining lockout minutes
 * @param string $lockoutUntil Lockout end time
 * @return int Remaining minutes
 */
function get_remaining_lockout_minutes($lockoutUntil) {
    require_once __DIR__ . '/../utility/manage_forgot_password_rate_limiting.php';
    return get_remaining_lockout_time($lockoutUntil);
}

/**
 * Reset all lockouts (admin function)
 */
function reset_all_lockouts() {
    require_once __DIR__ . '/../utility/reset_user_account_lockouts.php';
    reset_all_lockouts();
}

// ============================================================================
// PASSWORD SECURITY
// ============================================================================

/**
 * Hash password securely using bcrypt
 * @param string $password Plain text password
 * @return string Hashed password
 */
function hash_password($password) {
    require_once __DIR__ . '/../utility/hash_password.php';
    return hashPassword($password);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize security for API endpoints
 * Call this function at the start of every API endpoint
 */
function initSecurity() {
    setSecurityHeaders();
    setSecureCORS();
}

?>