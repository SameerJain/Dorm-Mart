<?php
/**
 * Router for Railway deployment
 * Routes API requests to PHP files, serves React SPA for all other routes
 */

$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$requestPath = parse_url($requestUri, PHP_URL_PATH);

// Route API requests to PHP files
if (strpos($requestPath, '/api/') === 0) {
    // Remove /api prefix and route to actual PHP file
    $apiPath = substr($requestPath, 5); // Remove '/api/'

    // Remove query string for routing
    $apiPath = strtok($apiPath, '?');

    // Reject path traversal and null-byte injection
    if (strpos($apiPath, '..') !== false || strpos($apiPath, "\0") !== false) {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => 'Invalid path']);
        exit;
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

    // Verify the resolved path stays inside the api/ directory
    $apiRoot = realpath(__DIR__ . '/api');
    $resolved = $apiRoot !== false ? realpath($apiFile) : false;
    if ($resolved === false || $apiRoot === false || strpos($resolved, $apiRoot . DIRECTORY_SEPARATOR) !== 0) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => 'API endpoint not found']);
        exit;
    }

    // If API file exists, include it
    if (file_exists($apiFile) && is_file($apiFile)) {
        require $apiFile;
        exit;
    }

    // API file not found
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'API endpoint not found']);
    exit;
}

// Serve static files from build directory
$buildPath = __DIR__ . '/build' . $requestPath;

// If requesting root, serve index.html
if ($requestPath === '/' || $requestPath === '') {
    $buildPath = __DIR__ . '/build/index.html';
}

// Shared security headers for all static responses
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: geolocation=(), microphone=(), camera=()');
header_remove('X-Powered-By');
if ($isHttps) {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}

// If file exists in build directory, serve it
if (file_exists($buildPath) && is_file($buildPath)) {
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
        header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' wss:; frame-ancestors 'none';");
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
    header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' wss:; frame-ancestors 'none';");
    readfile($indexPath);
    exit;
}

// Fallback 404
http_response_code(404);
echo '404 Not Found';
