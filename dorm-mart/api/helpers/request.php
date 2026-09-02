<?php
declare(strict_types=1);

require_once __DIR__ . '/response.php';

const MAX_JSON_REQUEST_BYTES = 1024 * 1024;

if (!function_exists('decode_json_object')) {
    function decode_json_object(string $raw): ?array
    {
        if ($raw === '' || strlen($raw) > MAX_JSON_REQUEST_BYTES) {
            return null;
        }

        $payload = json_decode($raw);
        if (!is_object($payload) || json_last_error() !== JSON_ERROR_NONE) {
            return null;
        }

        return (array)$payload;
    }
}

if (!function_exists('json_request_body')) {
    function json_request_body(): array
    {
        return json_request_body_or_error();
    }
}

if (!function_exists('json_request_body_or_error')) {
    function json_request_body_or_error(array $errorPayload = ['success' => false, 'error' => 'Invalid JSON payload']): array
    {
        $contentLength = filter_var($_SERVER['CONTENT_LENGTH'] ?? null, FILTER_VALIDATE_INT);
        if ($contentLength !== false && $contentLength > MAX_JSON_REQUEST_BYTES) {
            json_response(['success' => false, 'error' => 'Request body is too large'], 413);
        }

        $raw = file_get_contents('php://input', false, null, 0, MAX_JSON_REQUEST_BYTES + 1);
        $payload = is_string($raw) ? decode_json_object($raw) : null;
        if ($payload === null) {
            json_response($errorPayload, 400);
        }

        return $payload;
    }
}

if (!function_exists('request_int')) {
    function request_int(array $source, string $key, int $default = 0): int
    {
        if (!array_key_exists($key, $source)) {
            return $default;
        }

        $value = strict_integer_value($source[$key]);
        return $value ?? $default;
    }
}

if (!function_exists('strict_integer_value')) {
    function strict_integer_value($value): ?int
    {
        if (is_int($value)) {
            return $value;
        }
        if (!is_string($value) || !preg_match('/^-?(?:0|[1-9]\d*)$/D', $value)) {
            return null;
        }

        $validated = filter_var($value, FILTER_VALIDATE_INT);
        return $validated === false ? null : $validated;
    }
}

if (!function_exists('strict_decimal_value')) {
    function strict_decimal_value($value): ?float
    {
        if (!is_int($value) && !is_float($value)
            && (!is_string($value) || !preg_match('/^-?(?:\d+(?:\.\d+)?|\.\d+)$/D', $value))) {
            return null;
        }

        $number = (float)$value;
        return is_finite($number) ? $number : null;
    }
}

if (!function_exists('strict_boolean_value')) {
    function strict_boolean_value($value): ?bool
    {
        if (is_bool($value)) {
            return $value;
        }
        if ($value === 1 || $value === '1') {
            return true;
        }
        if ($value === 0 || $value === '0') {
            return false;
        }
        return null;
    }
}

if (!function_exists('strict_iso_datetime_value')) {
    function strict_iso_datetime_value($value): ?DateTimeImmutable
    {
        if (!is_string($value)
            || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/D', $value)) {
            return null;
        }

        try {
            $date = new DateTimeImmutable($value);
        } catch (Throwable $e) {
            return null;
        }
        $errors = DateTimeImmutable::getLastErrors();
        if (is_array($errors) && ($errors['warning_count'] > 0 || $errors['error_count'] > 0)) {
            return null;
        }
        return $date;
    }
}

if (!function_exists('validate_password_policy')) {
    function validate_password_policy(string $password): bool
    {
        return strlen($password) >= 8
            && preg_match('/[a-z]/', $password)
            && preg_match('/[A-Z]/', $password)
            && preg_match('/\d/', $password)
            && (bool) preg_match('/[^A-Za-z0-9]/', $password);
    }
}
