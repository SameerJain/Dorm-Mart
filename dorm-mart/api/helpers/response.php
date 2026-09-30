<?php
declare(strict_types=1);

if (!function_exists('json_response')) {
    /**
     * Send $payload as JSON with $statusCode and end the request.
     *
     * @return never
     */
    function json_response($payload, int $statusCode = 200, int $flags = 0): void
    {
        http_response_code($statusCode);
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
        }
        echo json_encode($payload, $flags);
        exit;
    }
}

if (!function_exists('json_response_after')) {
    /**
     * Respond no sooner than $minSeconds after $startedAt (a microtime(true)
     * value), so every outcome of an enumeration-sensitive request takes the
     * same time and timing cannot reveal which branch ran.
     *
     * @return never
     */
    function json_response_after(float $startedAt, float $minSeconds, $payload, int $statusCode = 200): void
    {
        $remainingMicros = (int)max(0, ($minSeconds - (microtime(true) - $startedAt)) * 1000000);
        if ($remainingMicros > 0) {
            usleep($remainingMicros);
        }
        json_response($payload, $statusCode);
    }
}

if (!function_exists('allow_options_request')) {
    function allow_options_request(int $statusCode = 204): void
    {
        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
            http_response_code($statusCode);
            exit;
        }
    }
}

if (!function_exists('require_request_method')) {
    function require_request_method(string $method, array $payload = ['success' => false, 'error' => 'Method Not Allowed']): void
    {
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
            json_response($payload, 405);
        }
    }
}

if (!function_exists('require_cli')) {
    function require_cli(): void
    {
        if (php_sapi_name() !== 'cli') {
            http_response_code(403);
            if (!headers_sent()) {
                header('Content-Type: application/json; charset=utf-8');
            }
            echo json_encode(['ok' => false, 'error' => 'Forbidden']);
            exit;
        }
    }
}

if (!function_exists('api_fail')) {
    /**
     * Roll back, log, and answer 500.
     *
     * @return never
     */
    function api_fail(Throwable $e, string $context, $conn = null): void
    {
        if (isset($conn) && $conn instanceof mysqli) {
            try {
                $conn->rollback();
            } catch (Throwable $_) {
            }
        }
        error_log($context . ' error: ' . $e->getMessage());
        json_response(['success' => false, 'error' => 'Internal server error'], 500);
    }
}
