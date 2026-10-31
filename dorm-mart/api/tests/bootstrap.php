<?php
/**
 * Shared helpers for the api/tests integration scripts.
 *
 * Set API_TEST_BASE_URL (e.g. http://localhost/f25-no-brainers/dorm-mart/api) when
 * running from CLI or when auto-detection from SCRIPT_NAME is wrong.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/app_config.php';

if (php_sapi_name() !== 'cli' && !dm_is_local_host((string)($_SERVER['HTTP_HOST'] ?? ''))) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Not found']);
    exit;
}

/**
 * Base URL of the api/ directory (no trailing slash).
 */
function api_test_api_base_url(): string
{
    $env = getenv('API_TEST_BASE_URL');
    if (is_string($env) && $env !== '') {
        return rtrim($env, '/');
    }

    $apiBase = dm_api_base_url();
    if ($apiBase !== '' && $apiBase !== '/api') {
        return rtrim($apiBase, '/');
    }

    if (!empty($_SERVER['HTTP_HOST']) && !empty($_SERVER['SCRIPT_NAME'])) {
        $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
        $scheme = $https ? 'https' : 'http';
        $script = str_replace('\\', '/', (string) $_SERVER['SCRIPT_NAME']);
        // .../api/tests/.../script.php -> .../api
        if (preg_match('#^(.*)/api/tests/#', $script, $m)) {
            return $scheme . '://' . $_SERVER['HTTP_HOST'] . $m[1] . '/api';
        }
        if (preg_match('#^(.*)/api/#', $script, $m)) {
            return $scheme . '://' . $_SERVER['HTTP_HOST'] . rtrim($m[1], '/') . '/api';
        }
        return $scheme . '://' . $_SERVER['HTTP_HOST'] . '/api';
    }

    return 'http://localhost/dorm-mart/api';
}

/**
 * Cross-platform temp file for cURL cookie jars in test scripts.
 */
function api_test_cookie_jar_path(): string
{
    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
        . DIRECTORY_SEPARATOR
        . 'dorm_mart_api_test_cookies.txt';
}

/**
 * POST JSON to an endpoint under api/ (path like "auth/reset_password.php").
 *
 * @param string|null $cookieJar Pass a session's cookie_jar (from
 *     api_test_login_session()) to call an endpoint that requires login;
 *     omit it for endpoints that don't.
 * @return array{http_code: int, raw: string, json: mixed}
 */
function api_test_post_json(string $pathUnderApi, array $payload, ?string $cookieJar = null): array
{
    $pathUnderApi = ltrim(str_replace('\\', '/', $pathUnderApi), '/');
    $url = api_test_api_base_url() . '/' . $pathUnderApi;
    $ch = curl_init($url);
    if ($ch === false) {
        return ['http_code' => 0, 'raw' => '', 'json' => null];
    }
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 45,
    ]);
    if ($cookieJar !== null) {
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieJar);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieJar);
    }
    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $rawStr = $raw === false ? '' : (string) $raw;

    return [
        'http_code' => $code,
        'raw' => $rawStr,
        'json' => json_decode($rawStr, true),
    ];
}

/**
 * Logs in with credentials from API_TEST_LOGIN_EMAIL / API_TEST_LOGIN_PASSWORD and
 * returns an authenticated session (cookie jar + CSRF token), or null when the env
 * vars are unset or the login fails. Scripts that only exercise auth-gated endpoints
 * must treat a null return as "cannot run this check" rather than as a pass — an
 * unauthenticated 401 proves nothing about the endpoint's own validation.
 *
 * @return array{cookie_jar: string, csrf_token: string}|null
 */
function api_test_login_session(): ?array
{
    $email = getenv('API_TEST_LOGIN_EMAIL');
    $password = getenv('API_TEST_LOGIN_PASSWORD');
    if (!is_string($email) || $email === '' || !is_string($password) || $password === '') {
        return null;
    }

    $cookieJar = api_test_cookie_jar_path();
    @unlink($cookieJar);

    $ch = curl_init(api_test_api_base_url() . '/auth/login.php');
    if ($ch === false) {
        return null;
    }
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['email' => $email, 'password' => $password]),
        CURLOPT_COOKIEJAR => $cookieJar,
        CURLOPT_COOKIEFILE => $cookieJar,
        CURLOPT_TIMEOUT => 30,
    ]);
    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $json = is_string($raw) ? json_decode($raw, true) : null;
    if ($code !== 200 || !is_array($json) || empty($json['ok']) || !empty($json['requires_two_factor'])) {
        return null;
    }

    $ch = curl_init(api_test_api_base_url() . '/auth/get_csrf_token.php');
    if ($ch === false) {
        return null;
    }
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPGET => true,
        CURLOPT_COOKIEJAR => $cookieJar,
        CURLOPT_COOKIEFILE => $cookieJar,
        CURLOPT_TIMEOUT => 30,
    ]);
    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $json = is_string($raw) ? json_decode($raw, true) : null;
    $token = is_array($json) && isset($json['csrf_token']) ? (string) $json['csrf_token'] : '';
    if ($code !== 200 || $token === '') {
        return null;
    }

    return ['cookie_jar' => $cookieJar, 'csrf_token' => $token];
}
