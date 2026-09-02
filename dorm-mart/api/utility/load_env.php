<?php

function load_env(): void
{
    static $loaded = false;
    if ($loaded) {
        return;
    }
    $loaded = true;

    $root = dirname(__DIR__, 2);
    $envFile = dm_resolve_env_file($root);
    if ($envFile === null) {
        return;
    }

    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        [$key, $value] = array_pad(explode('=', $line, 2), 2, '');
        $key = trim($key);
        if ($key === '' || getenv($key) !== false) {
            continue;
        }

        putenv($key . '=' . dm_clean_env_value($value));
    }
}

function dm_resolve_env_file(string $root): ?string
{
    $explicitFile = getenv('ENV_FILE');
    if ($explicitFile !== false && trim($explicitFile) !== '') {
        $path = trim($explicitFile);
        if (!preg_match('/^[A-Za-z]:[\/\\\\]/', $path) && !str_starts_with($path, '/')) {
            $path = $root . DIRECTORY_SEPARATOR . $path;
        }
        return is_readable($path) ? $path : null;
    }

    $appEnv = getenv('APP_ENV');
    if ($appEnv === false || trim($appEnv) === '') {
        foreach (['development', 'local'] as $fallbackEnv) {
            $fallback = "{$root}/.env.{$fallbackEnv}";
            if (is_readable($fallback)) {
                return $fallback;
            }
        }
        return null;
    }

    $safeEnv = strtolower(trim($appEnv));
    $allowed = ['development', 'local', 'production', 'cattle'];
    if (!in_array($safeEnv, $allowed, true)) {
        error_log("load_env: unsupported APP_ENV '{$safeEnv}'");
        return null;
    }

    $path = "{$root}/.env.{$safeEnv}";
    return is_readable($path) ? $path : null;
}

function dm_clean_env_value(string $value): string
{
    $value = trim($value);
    if (strlen($value) >= 2) {
        $first = $value[0];
        $last = $value[strlen($value) - 1];
        if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
            return substr($value, 1, -1);
        }
    }
    return $value;
}
