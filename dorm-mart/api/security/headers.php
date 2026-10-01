<?php
// Response security headers, HTTPS enforcement, and CORS.
// Endpoints load this through security.php.
require_once __DIR__ . '/../config/app_config.php';
require_once __DIR__ . '/transport.php';

// SECURITY HEADERS

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

    if (is_https_request()) return;

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

/**
 * Set comprehensive security headers for all API endpoints
 * This function should be called at the start of every API endpoint
 */
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

// INITIALIZATION

/**
 * Initialize security for API endpoints
 * Call this function at the start of every API endpoint
 */
function init_security() {
    set_security_headers();
    set_secure_cors();
}
