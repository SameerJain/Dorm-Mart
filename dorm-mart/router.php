<?php
/**
 * Router for Railway deployment
 * Routes API requests to PHP files, serves React SPA for all other routes
 */

ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('log_errors', '1');

$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$requestPath = parse_url($requestUri, PHP_URL_PATH);
header_remove('X-Powered-By');

// Same HTTPS check and CSP the API sends, so the two cannot drift apart.
require_once __DIR__ . '/api/security/transport.php';

function router_api_error(int $status, string $error): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => $error]);
    exit;
}

function router_not_found(): void
{
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo '404 Not Found';
    exit;
}

// Route API requests to PHP files
if (strpos($requestPath, '/api/') === 0) {
    // Remove /api prefix and route to actual PHP file
    $apiPath = substr($requestPath, 5); // Remove '/api/'

    // Remove query string for routing
    $apiPath = strtok($apiPath, '?');

    // Reject path traversal and null-byte injection
    if (strpos($apiPath, '..') !== false || strpos($apiPath, "\0") !== false) {
        router_api_error(400, 'Invalid path');
    }

    // Build full path to API file
    $apiFile = __DIR__ . '/api/' . $apiPath;

    // If it's a directory, try index.php
    if (is_dir($apiFile)) {
        $apiFile .= '/index.php';
    }

    // If file doesn't exist, try adding .php extension
    if (!file_exists($apiFile) && !is_dir($apiFile)) {
        $apiFile = __DIR__ . '/api/' . $apiPath . '.php';
    }

    // Only a real .php file inside api/ is routable. Using the realpath-verified
    // $resolved everywhere below prevents extension and casing tricks.
    $apiRoot = realpath(__DIR__ . '/api');
    $resolved = $apiRoot !== false ? realpath($apiFile) : false;
    if ($resolved === false
        || strpos($resolved, $apiRoot . DIRECTORY_SEPARATOR) !== 0
        || strtolower((string)pathinfo($resolved, PATHINFO_EXTENSION)) !== 'php'
        || !is_file($resolved)) {
        router_api_error(404, 'API endpoint not found');
    }

    // Directories that are never HTTP endpoints (libraries, CLI tools, tests).
    $blockedDirs = ['tests/', 'database/', 'helpers/', 'security/', 'utility/', 'config/'];
    $relPath = str_replace('\\', '/', ltrim(substr($resolved, strlen($apiRoot)), DIRECTORY_SEPARATOR));
    foreach ($blockedDirs as $dir) {
        if (str_starts_with($relPath, $dir)) {
            router_api_error(404, 'API endpoint not found');
        }
    }

    require $resolved;
    exit;
}

// Serve static files from build directory. Decode before validating so encoded
// traversal sequences cannot bypass the containment check. Uploaded media is
// only served through the authorization-aware API.
$decodedRequestPath = rawurldecode($requestPath);
if (strpos($decodedRequestPath, "\0") !== false
    || preg_match('#(?:^|[\\\\/])\.\.(?:[\\\\/]|$)#', $decodedRequestPath)
    || str_starts_with($decodedRequestPath, '/media/')) {
    router_not_found();
}

$buildRoot = realpath(__DIR__ . '/build');
$buildPath = __DIR__ . '/build' . $decodedRequestPath;

// If requesting root, serve index.html
if ($decodedRequestPath === '/' || $decodedRequestPath === '') {
    $buildPath = __DIR__ . '/build/index.html';
}

// Shared security headers for all static responses
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: geolocation=(), microphone=(), camera=()');
header('Cross-Origin-Opener-Policy: same-origin');
header_remove('X-Powered-By');
if (is_https_request()) {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}

// If file exists in build directory, serve it
// Only serve an existing file when its resolved path remains inside build/.
$resolvedBuildPath = $buildRoot !== false ? realpath($buildPath) : false;
if ($resolvedBuildPath !== false
    && $buildRoot !== false
    && str_starts_with($resolvedBuildPath, $buildRoot . DIRECTORY_SEPARATOR)
    && is_file($resolvedBuildPath)) {
    $buildPath = $resolvedBuildPath;
    // Set appropriate content type
    $ext = pathinfo($buildPath, PATHINFO_EXTENSION);
    $mimeTypes = [
        'html' => 'text/html',
        'js' => 'application/javascript',
        'css' => 'text/css',
        'json' => 'application/json',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
        'webp' => 'image/webp',
        'pdf' => 'application/pdf',
        'woff2' => 'font/woff2',
        'woff' => 'font/woff',
        'ttf' => 'font/ttf',
    ];

    $extLower = strtolower((string) $ext);
    $contentType = $mimeTypes[$extLower] ?? 'application/octet-stream';
    header('Content-Type: ' . $contentType);

    // CSP on HTML responses; JS/CSS/fonts get cache headers instead
    if ($extLower === 'html') {
        header('Content-Security-Policy: ' . security_csp_header());
    } elseif (in_array($extLower, ['js', 'css', 'woff2', 'woff', 'ttf'], true)) {
        header('Cache-Control: public, max-age=31536000, immutable');
    }

    // Without application/pdf, browsers treat PDFs as octet-stream and force download (weird filenames on some clients).
    if ($extLower === 'pdf') {
        header('Content-Disposition: inline');
    }

    readfile($buildPath);
    exit;
}

// For React Router (SPA), serve index.html for all non-API routes
$indexPath = __DIR__ . '/build/index.html';
if (file_exists($indexPath)) {
    header('Content-Type: text/html');
    header('Content-Security-Policy: ' . security_csp_header());
    readfile($indexPath);
    exit;
}

router_not_found();
