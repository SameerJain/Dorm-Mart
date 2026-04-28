<?php
/**
 * Shared helpers for api_test_files integration scripts.
 *
 * Set API_TEST_BASE_URL (e.g. http://localhost/f25-no-brainers/dorm-mart/api) when
 * running from CLI or when auto-detection from SCRIPT_NAME is wrong.
 */

declare(strict_types=1);

/**
 * Base URL of the api/ directory (no trailing slash).
 */
function api_test_api_base_url(): string
{
    $env = getenv('API_TEST_BASE_URL');
    if (is_string($env) && $env !== '') {
        return rtrim($env, '/');
    }

    if (!empty($_SERVER['HTTP_HOST']) && !empty($_SERVER['SCRIPT_NAME'])) {
        $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
        $scheme = $https ? 'https' : 'http';
        $script = str_replace('\\', '/', (string) $_SERVER['SCRIPT_NAME']);
        // .../api/api_test_files/.../script.php -> .../api
        if (preg_match('#^(.*)/api/api_test_files/#', $script, $m)) {
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
 * @return array{http_code: int, raw: string, json: mixed}
 */
function api_test_post_json(string $pathUnderApi, array $payload): array
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
