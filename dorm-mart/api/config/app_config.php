<?php

declare(strict_types=1);

require_once __DIR__ . '/../utility/load_env.php';
load_env();

function dm_env_string(string $key, string $default = ''): string
{
    $value = getenv($key);
    if ($value === false || trim((string)$value) === '') {
        return $default;
    }
    return trim((string)$value);
}

function dm_env_bool(string $key, bool $default = false): bool
{
    $value = getenv($key);
    if ($value === false || trim((string)$value) === '') {
        return $default;
    }

    $normalized = strtolower(trim((string)$value));
    if (in_array($normalized, ['1', 'true', 'yes', 'on'], true)) {
        return true;
    }
    if (in_array($normalized, ['0', 'false', 'no', 'off'], true)) {
        return false;
    }
    return $default;
}

function dm_env_list(string $key): array
{
    $value = getenv($key);
    if ($value === false || trim((string)$value) === '') {
        return [];
    }

    return array_values(array_filter(array_map(
        static fn($item) => rtrim(trim($item), '/'),
        explode(',', (string)$value)
    )));
}

function dm_base_url(string $url): string
{
    return rtrim(trim($url), '/');
}

function dm_url_origin(string $url): string
{
    $scheme = parse_url($url, PHP_URL_SCHEME);
    $host = parse_url($url, PHP_URL_HOST);
    if (!is_string($scheme) || !is_string($host) || $scheme === '' || $host === '') {
        return dm_base_url($url);
    }

    $port = parse_url($url, PHP_URL_PORT);
    return $scheme . '://' . $host . ($port ? ":{$port}" : '');
}

function dm_request_scheme(): string
{
    $forwarded = $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '';
    if ($forwarded !== '') {
        return strtolower(explode(',', $forwarded)[0]) === 'https' ? 'https' : 'http';
    }
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
}

function dm_request_origin(): string
{
    $host = $_SERVER['HTTP_HOST'] ?? '';
    return $host !== '' ? dm_request_scheme() . '://' . $host : '';
}

function dm_frontend_base_url(): string
{
    $configured = dm_base_url(dm_env_string('FRONTEND_BASE_URL'));
    if ($configured !== '') {
        return $configured;
    }

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && filter_var($origin, FILTER_VALIDATE_URL)) {
        return dm_base_url($origin);
    }

    $requestOrigin = dm_request_origin();
    $publicUrl = dm_env_string('PUBLIC_URL');
    if ($requestOrigin === '') {
        return dm_base_url($publicUrl);
    }

    return dm_base_url($requestOrigin . '/' . ltrim($publicUrl, '/'));
}

function dm_api_base_url(): string
{
    $configured = dm_base_url(dm_env_string('API_BASE_URL'));
    if ($configured !== '') {
        return $configured;
    }

    $requestOrigin = dm_request_origin();
    $publicUrl = dm_env_string('PUBLIC_URL');
    if ($requestOrigin === '') {
        return dm_base_url('/api');
    }

    $publicPath = trim($publicUrl, '/');
    return dm_base_url($requestOrigin . ($publicPath !== '' ? "/{$publicPath}" : '') . '/api');
}

function dm_api_url(string $path): string
{
    return dm_api_base_url() . '/' . ltrim($path, '/');
}

function dm_frontend_url(string $hashRoute): string
{
    return dm_frontend_base_url() . '/#/' . ltrim($hashRoute, '#/');
}

function dm_cors_allowed_origins(): array
{
    $origins = array_map('dm_url_origin', dm_env_list('CORS_ALLOWED_ORIGINS'));

    $frontend = dm_base_url(dm_env_string('FRONTEND_BASE_URL'));
    if ($frontend !== '') {
        $origins[] = dm_url_origin($frontend);
    }

    $requestOrigin = dm_request_origin();
    if ($requestOrigin !== '') {
        $origins[] = $requestOrigin;
    }

    $apiOrigin = dm_url_origin(dm_api_base_url());
    if ($apiOrigin !== '') {
        $origins[] = $apiOrigin;
    }

    return array_values(array_unique(array_filter(array_map('dm_base_url', $origins))));
}

function dm_is_local_host(string $host): bool
{
    return $host === 'localhost'
        || str_starts_with($host, 'localhost:')
        || str_starts_with($host, '127.0.0.1')
        || str_starts_with($host, '[::1]');
}

function dm_is_allowed_redirect_host(string $host): bool
{
    $urls = array_merge(dm_env_list('CORS_ALLOWED_ORIGINS'), [
        dm_base_url(dm_env_string('FRONTEND_BASE_URL')),
        dm_base_url(dm_env_string('API_BASE_URL')),
    ]);

    foreach ($urls as $url) {
        $allowedHost = parse_url($url, PHP_URL_HOST);
        if (!is_string($allowedHost) || $allowedHost === '') {
            continue;
        }

        $port = parse_url($url, PHP_URL_PORT);
        if ($host === ($port ? "{$allowedHost}:{$port}" : $allowedHost)) {
            return true;
        }
    }

    return false;
}

function dm_mail_from_email(): string
{
    return dm_env_string('MAIL_FROM_EMAIL', dm_env_string('GMAIL_USERNAME'));
}

function dm_mail_from_name(): string
{
    return dm_env_string('MAIL_FROM_NAME', 'Dorm Mart');
}

function dm_mail_reply_to_email(): string
{
    return dm_env_string('MAIL_REPLY_TO_EMAIL', dm_mail_from_email());
}

function dm_mail_reply_to_name(): string
{
    return dm_env_string('MAIL_REPLY_TO_NAME', 'Dorm Mart Support');
}

function dm_support_email(): string
{
    return dm_env_string('SUPPORT_EMAIL', dm_mail_reply_to_email());
}

function dm_smtp_host(): string
{
    return dm_env_string('SMTP_HOST', 'smtp.gmail.com');
}

function dm_smtp_port(): int
{
    return (int)dm_env_string('SMTP_PORT', '587');
}

function dm_smtp_secure(): string
{
    return strtolower(dm_env_string('SMTP_SECURE', 'starttls'));
}

function dm_smtp_timeout(): int
{
    return max(1, (int)dm_env_string('SMTP_TIMEOUT', '10'));
}
