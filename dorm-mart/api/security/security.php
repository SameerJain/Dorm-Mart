<?php
/**
 * Security entry point for every API endpoint and helper.
 *
 * Loads each security module; require this file rather than a module directly.
 */

require_once __DIR__ . '/../config/app_config.php';
require_once __DIR__ . '/transport.php';

// API failures belong in server logs, never in HTTP responses.
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('log_errors', '1');

require_once __DIR__ . '/headers.php';  // response headers, HTTPS, CORS
require_once __DIR__ . '/input.php';    // input normalization, HTML escaping
require_once __DIR__ . '/rate_limit.php'; // throttling and Turnstile
require_once __DIR__ . '/password.php'; // password hashing
