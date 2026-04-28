<?php
// Handle password reset token redirects
// Redirect to the password reset page with the token

require_once __DIR__ . '/../config/app_config.php';

// Security headers before any output or redirect
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer'); // prevent token leaking via Referer to destination page
header_remove('X-Powered-By');
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
if ($isHttps) {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}

$token = $_GET['token'] ?? '';

// Validate token format: must be a 64-character hex string
if (!empty($token) && !preg_match('/^[0-9a-f]{64}$/i', $token)) {
    $token = ''; // treat malformed tokens as missing
}

// Validate token exists
if (empty($token)) {
    header('Location: ' . dm_frontend_url('login?error=invalid_reset_link'));
    exit;
}

header('Location: ' . dm_frontend_url('reset-password?token=' . urlencode($token)));
exit;
