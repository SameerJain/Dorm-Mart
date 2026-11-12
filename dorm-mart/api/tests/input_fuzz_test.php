<?php
declare(strict_types=1);

// Input validation sweep over real HTTP: every routable endpoint is sent wrong
// types, oversized text, SQL- and script-shaped strings, and out-of-range
// numbers in every field it reads. Bad input must be answered with a clear
// 4xx (or handled normally), never a 5xx, and JSON endpoints must still answer
// in JSON. A 500 here means a field reached code that assumed it was valid.
//
// Field names are read from each endpoint's source, so a new endpoint or a new
// field is covered without editing this file.
require __DIR__ . '/support/integration_harness.php';

// Never served by router.php (see $blockedDirs there).
const FUZZ_BLOCKED_DIRS = ['tests', 'database', 'helpers', 'security', 'utility', 'config'];
const FUZZ_SKIP = [
    // Would end or destroy the session this sweep depends on.
    'auth/logout.php', 'auth/delete_account.php',
    // Signed Stripe callbacks: they answer 503 by design while payments are off,
    // and mock_payment_test.php covers their signature and payload handling.
    'payments/webhook_live.php', 'payments/webhook_test.php',
    'payments/account_webhook_live.php', 'payments/account_webhook_test.php',
];
// A query string longer than this is refused by the test server before PHP runs.
const FUZZ_MAX_QUERY_TEXT = 2000;

function fuzz_values(): array
{
    return [
        'nested array' => ['a' => ['b' => ['c']]],
        'empty array' => [],
        'sql text' => "' OR '1'='1'; DROP TABLE user_accounts; --",
        'script text' => '<script>alert(1)</script><img src=x onerror=alert(1)>',
        'long text' => str_repeat('A', 70000),
        'four-byte text' => "\u{1F600}\u{1F4A9} \u{202E}reversed",
        'null byte' => "abc\0def",
        'negative' => -1,
        'huge number' => 99999999999999999999,
        'numeric overflow text' => '1e309',
        'null' => null,
        'true' => true,
        'whitespace' => "  \t\n ",
    ];
}

/** Routable endpoint paths relative to api/. */
function fuzz_endpoints(string $apiRoot): array
{
    $found = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($apiRoot, FilesystemIterator::SKIP_DOTS));
    foreach ($iterator as $file) {
        $relative = str_replace('\\', '/', substr($file->getPathname(), strlen($apiRoot) + 1));
        if (!str_ends_with($relative, '.php')) continue;
        if (in_array(explode('/', $relative)[0], FUZZ_BLOCKED_DIRS, true)) continue;
        if (in_array($relative, FUZZ_SKIP, true)) continue;
        $found[] = $relative;
    }
    sort($found);
    return $found;
}

/** Request field names an endpoint reads, taken from its source. */
function fuzz_fields(string $source): array
{
    $patterns = [
        '/\$(?:payload|input|body|data|json|request|params|_GET|_POST|_REQUEST)\[\s*[\'"]([A-Za-z_][A-Za-z0-9_]*)[\'"]\s*\]/',
        '/(?:request_int|require_product_id)\(\s*\$\w+\s*,\s*[\'"]([A-Za-z_][A-Za-z0-9_]*)[\'"]/',
    ];
    $fields = str_contains($source, 'require_product_id(') ? ['product_id' => true] : [];
    foreach ($patterns as $pattern) {
        preg_match_all($pattern, $source, $matches);
        foreach ($matches[1] as $name) $fields[$name] = true;
    }
    unset($fields['csrf_token']);
    return array_keys($fields);
}

function fuzz_send(int $user, string $endpoint, bool $isGet, array $fields): array
{
    if ($isGet) {
        $fields = array_map(
            static fn($value) => is_string($value) ? substr($value, 0, FUZZ_MAX_QUERY_TEXT) : $value,
            $fields
        );
        return api($user, $endpoint . ($fields ? '?' . http_build_query($fields) : ''), null);
    }
    return api($user, $endpoint, $fields);
}

// Without a signing secret ws_token.php answers 500 before reading any input.
putenv('WS_TOKEN_SECRET=fuzz-only-secret');
harness_start('fuzz', 3);

// Real ids for the sweep to aim at, so requests get past "not found" checks.
$conn->query("INSERT INTO INVENTORY (title, description, seller_id, item_condition, item_status, item_location, listing_price, price_nego, trades, photos)
              VALUES ('Fuzz desk', 'A desk', 1, 'Good', 'Active', 'North Campus', 25, 1, 0, '[\"/test.jpg\"]')");
$productId = (int)$conn->insert_id;
$conversation = api(2, 'chat/ensure_conversation.php', ['product_id' => $productId]);
if (!ok($conversation)) throw new RuntimeException('Fuzz fixture conversation failed: ' . json_encode($conversation));

$apiRoot = dirname(__DIR__);
$endpoints = fuzz_endpoints($apiRoot);
$values = fuzz_values();
$requests = 0;

foreach ($endpoints as $endpoint) {
    $source = (string)file_get_contents($apiRoot . '/' . $endpoint);
    $isJsonEndpoint = str_contains($source, 'init_json_endpoint(');
    $isGet = (bool)preg_match("/init_json_endpoint\\(\\s*'GET'/", $source) || !$isJsonEndpoint;
    $fields = fuzz_fields($source);
    $problems = [];

    $cases = ['no fields' => []];
    foreach ($values as $label => $value) {
        if ($fields) $cases["every field = $label"] = array_fill_keys($fields, $value);
        // One bad field among otherwise plausible ids reaches deeper checks.
        foreach ($fields as $field) {
            $cases["$field = $label"] = [$field => $value] + array_fill_keys($fields, 1);
        }
    }

    foreach ($cases as $label => $payload) {
        // The seller sends everything; the buyer repeats only the all-fields cases.
        foreach (str_starts_with($label, 'every field') || $label === 'no fields' ? [1, 2] : [1] as $user) {
            $response = fuzz_send($user, $endpoint, $isGet, $payload);
            $requests++;
            if ($response['status'] >= 500 || $response['status'] === 0) {
                $problems[] = "user $user, $label: HTTP " . $response['status'];
            } elseif ($isJsonEndpoint && !is_array($response['body'])) {
                $problems[] = "user $user, $label: HTTP " . $response['status'] . ' with a non-JSON body';
            }
        }
    }

    check($problems === [], "$endpoint answers bad input without a server error (" . count($fields) . ' fields)');
    foreach (array_slice($problems, 0, 6) as $problem) echo "     $problem" . PHP_EOL;
    if (count($problems) > 6) echo '     ... and ' . (count($problems) - 6) . ' more' . PHP_EOL;

    // A sweep that silently lost its session would only be testing the login check.
    foreach ([1, 2] as $user) {
        if (!ok(api($user, 'auth/me.php', null))) harness_login($user);
    }
}

check($requests > 1000, "the sweep sent a meaningful number of requests ($requests)");
check((int)row('SELECT COUNT(*) AS n FROM user_accounts')['n'] === 3, 'no account was created or deleted by bad input');
check((int)row("SELECT COUNT(*) AS n FROM INVENTORY WHERE product_id=$productId AND title='Fuzz desk'")['n'] === 1, 'the fixture listing survived the sweep unchanged');
harness_finish();
