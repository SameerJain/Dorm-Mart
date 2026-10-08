<?php
declare(strict_types=1);

// Shared setup for the HTTP integration suites. Each suite gets its own randomly
// named local database, migrated from scratch, a private `php -S` server, and
// logged-in fixture users. Nothing touches application data, and outgoing email
// is disabled, so account and password-reset flows can run safely.
//
// Usage:
//   require __DIR__ . '/support/integration_harness.php';
//   harness_start('lifecycle', 4);   // users lifecycle1@ … lifecycle4@buffalo.edu
//   check(ok(api(1, 'some/endpoint.php', ['field' => 1])), 'what the endpoint promises');
//   harness_finish();
//
// Set HARNESS_KEEP_LOG=1 to keep the test server's PHP error log for a failed run.

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once __DIR__ . '/../../utility/load_env.php';
load_env();
if (!in_array(getenv('DB_HOST'), ['localhost', '127.0.0.1', '::1'], true)) {
    throw new RuntimeException('Integration tests require a local MySQL server.');
}
// load_env() never overrides a variable that is already set, so blanking these
// here keeps the test server from reaching Resend or SMTP.
foreach (['RESEND_API_KEY', 'GMAIL_USERNAME', 'GMAIL_PASSWORD'] as $mailSetting) {
    putenv($mailSetting . '=');
}

$root = dirname(__DIR__, 3);
$conn = null;
$base = '';
$cookies = [];
$tokens = [];
$password = '';
$checks = 0;
$failures = 0;
$harness = ['database' => null, 'server' => null, 'log' => null, 'prefix' => '', 'cleanup' => []];

/** Create the database, migrate it, add $users accounts, and log each one in. */
function harness_start(string $prefix, int $users): void
{
    global $conn, $base, $password, $harness, $root;

    $harness['prefix'] = $prefix;
    $harness['database'] = 'dm_' . $prefix . '_test_' . bin2hex(random_bytes(6));
    $harness['log'] = tempnam(sys_get_temp_dir(), 'dm-' . $prefix . '-');
    putenv('DB_NAME=' . $harness['database']);
    require_once __DIR__ . '/../../database/db_connect.php';
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $conn = db();
    register_shutdown_function('harness_cleanup');

    $log = $harness['log'];
    $migration = proc_open([PHP_BINARY, 'api/database/migrate_schema.php'],
        [0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes, $root);
    if (proc_close($migration) !== 0) {
        throw new RuntimeException('Test schema migration failed; inspect ' . $log);
    }

    $password = bin2hex(random_bytes(16)) . 'Aa1!';
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("INSERT INTO user_accounts (user_id, first_name, last_name, grad_month, grad_year, email, hash_pass)
                            VALUES (?, 'Harness', 'Test', 5, 2027, ?, ?)");
    for ($id = 1; $id <= $users; $id++) {
        $email = harness_email($id);
        $stmt->bind_param('iss', $id, $email, $hash);
        $stmt->execute();
    }
    $stmt->close();

    $socket = stream_socket_server('tcp://127.0.0.1:0');
    $address = stream_socket_get_name($socket, false);
    fclose($socket);
    $base = 'http://' . $address;
    $harness['server'] = proc_open([PHP_BINARY, '-S', $address, 'router.php'],
        [0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes, $root);
    for ($attempt = 0; $attempt < 50 && @file_get_contents($base . '/api/auth/get_csrf_token.php') === false; $attempt++) {
        usleep(100000);
    }

    for ($id = 1; $id <= $users; $id++) {
        harness_login($id);
    }
}

function harness_email(int $id): string
{
    global $harness;
    return $harness['prefix'] . $id . '@buffalo.edu';
}

/** Start a fresh session for $user (any cookie-jar key) and refresh its CSRF token. */
function harness_login($user, ?string $email = null, ?string $userPassword = null): void
{
    global $cookies, $password;
    if (isset($cookies[$user])) @unlink($cookies[$user]);
    $cookies[$user] = tempnam(sys_get_temp_dir(), 'dm-cookie-');
    $login = api($user, 'auth/login.php', ['email' => $email ?? harness_email((int)$user), 'password' => $userPassword ?? $password]);
    if (!ok($login)) {
        throw new RuntimeException('Fixture login failed: ' . json_encode($login));
    }
    harness_refresh_csrf($user);
}

function harness_refresh_csrf($user): void
{
    global $tokens;
    $tokens[$user] = api($user, 'auth/get_csrf_token.php', null)['body']['csrf_token'] ?? '';
}

/** A cookie jar with no session, for anonymous or unauthenticated requests. */
function harness_guest(string $name = 'guest'): string
{
    global $cookies, $tokens;
    if (isset($cookies[$name])) @unlink($cookies[$name]);
    $cookies[$name] = tempnam(sys_get_temp_dir(), 'dm-cookie-');
    $tokens[$name] = '';
    return $name;
}

/** Run $callback when the suite exits, even if it throws. */
function harness_on_cleanup(callable $callback): void
{
    global $harness;
    $harness['cleanup'][] = $callback;
}

function harness_cleanup(): void
{
    global $harness, $conn, $cookies;
    foreach (array_reverse($harness['cleanup']) as $callback) {
        try { $callback(); } catch (Throwable $e) { fwrite(STDERR, 'cleanup: ' . $e->getMessage() . PHP_EOL); }
    }
    $harness['cleanup'] = [];
    if (is_resource($harness['server'])) {
        proc_terminate($harness['server']);
        proc_close($harness['server']);
    }
    if ($conn instanceof mysqli && $harness['database']) {
        $conn->query('DROP DATABASE `' . $harness['database'] . '`');
        $conn->close();
        $harness['database'] = null;
    }
    foreach ($cookies as $cookie) @unlink($cookie);
    if ($harness['log'] && getenv('HARNESS_KEEP_LOG')) {
        fwrite(STDERR, 'Server log kept at ' . $harness['log'] . PHP_EOL);
    } elseif ($harness['log']) {
        @unlink($harness['log']);
    }
}

/** Print the tally and exit nonzero on any failure. */
function harness_finish(): void
{
    global $checks, $failures;
    echo "$checks checks, $failures failures" . PHP_EOL;
    exit($failures > 0 ? 1 : 0);
}

// --- checks -----------------------------------------------------------------

function check(bool $condition, string $message): void
{
    global $failures, $checks;
    $checks++;
    if (!$condition) $failures++;
    echo ($condition ? 'PASS ' : 'FAIL ') . $message . PHP_EOL;
}

function ok(array $response): bool { return $response['status'] === 200; }
function rejected(array $response): bool { return in_array($response['status'], [400, 403, 404, 409], true); }

/** True when the response has exactly this status and error text. */
function error_is(array $response, int $status, string $error): bool
{
    return $response['status'] === $status && ($response['body']['error'] ?? null) === $error;
}

function row(string $sql): array
{
    global $conn;
    return $conn->query($sql)->fetch_assoc() ?: [];
}

// --- requests ---------------------------------------------------------------

/**
 * Send a request as $user. A null $body sends a GET; an array is POSTed as JSON
 * with the user's CSRF token added unless the body already sets one.
 *
 * @return array{status: int, body: mixed, headers: string}
 */
function api($user, string $path, ?array $body = [], array $headers = []): array
{
    global $tokens;
    $options = [CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $headers)];
    if ($body !== null) {
        $body += ['csrf_token' => $tokens[$user] ?? ''];
        $options += [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($body)];
    }
    return harness_request($user, $path, $options);
}

/** POST multipart form fields (use CURLFile for uploads) with the user's CSRF token. */
function api_multipart($user, string $path, array $fields): array
{
    global $tokens;
    $fields += ['csrf_token' => $tokens[$user] ?? ''];
    return harness_request($user, $path, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $fields]);
}

/** GET without JSON decoding, for media: returns status, content type and raw bytes too. */
function http_get($user, string $path, array $headers = []): array
{
    return harness_request($user, $path, [CURLOPT_HTTPHEADER => $headers]);
}

function harness_request($user, string $path, array $options): array
{
    global $base, $cookies;
    $ch = curl_init($base . '/api/' . $path);
    curl_setopt_array($ch, $options + [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_COOKIEFILE => $cookies[$user],
        CURLOPT_COOKIEJAR => $cookies[$user],
    ]);
    $raw = (string)curl_exec($ch);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $response = [
        'status' => curl_getinfo($ch, CURLINFO_HTTP_CODE),
        'type' => (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE),
        'headers' => substr($raw, 0, $headerSize),
        'raw' => substr($raw, $headerSize),
    ];
    curl_close($ch);
    $response['body'] = json_decode($response['raw'], true);
    return $response;
}
