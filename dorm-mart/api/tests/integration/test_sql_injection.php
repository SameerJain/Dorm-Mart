<?php
/**
 * SQL Injection Test Script
 * Tests various endpoints for SQL injection vulnerabilities.
 *
 * Every endpoint below requires a logged-in session except Login itself. Set
 * API_TEST_LOGIN_EMAIL / API_TEST_LOGIN_PASSWORD to a real account before running
 * this script, or the auth-gated checks are skipped (and reported as skipped,
 * not silently counted as passing) instead of just recording an unauthenticated
 * 401 as a false "PASS".
 *
 * Usage: Run this script from command line or via web browser.
 */

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__, 2) . '/security/security.php';
set_security_headers();

header('Content-Type: text/html; charset=utf-8');

$session = api_test_login_session();

// Test payloads for SQL injection
$sqlPayloads = [
    "' OR '1'='1",
    "' OR '1'='1'--",
    "'; DROP TABLE users--",
    "' UNION SELECT NULL--",
    "' UNION SELECT password FROM users--",
    "1' OR '1'='1",
    "1' OR 1=1--",
    "admin'--",
    "' OR 1=1#",
    "') OR ('1'='1",
    "1' OR '1'='1' /*",
    "1' OR '1'='1' --",
    "1' OR '1'='1' #",
    "1' OR '1'='1' UNION SELECT NULL--",
    "1' OR '1'='1' UNION SELECT password FROM users--",
];

// Test endpoints. 'encoding' controls how the payload is sent: product_listing.php
// only accepts multipart/form-data (it rejects JSON with 415 before it ever looks
// at the fields), so a JSON-encoded request against it "passes" for a reason that
// has nothing to do with SQL injection.
$testEndpoints = [
    [
        'name' => 'Login',
        'url' => '/auth/login.php',
        'data' => ['email' => 'test@buffalo.edu', 'password' => 'test123'],
        'field' => 'email',
        'encoding' => 'json',
        'requires_auth' => false,
    ],
    [
        'name' => 'Search',
        'url' => '/search/get_search_items.php',
        'data' => ['q' => '', 'category' => ''],
        'field' => 'q',
        'encoding' => 'json',
        'requires_auth' => true,
    ],
    [
        'name' => 'Product Listing (Title)',
        'url' => '/seller_dashboard/product_listing.php',
        'data' => ['mode' => 'create', 'title' => '', 'description' => 'Test', 'price' => '10'],
        'field' => 'title',
        'encoding' => 'multipart',
        'requires_auth' => true,
    ],
];

echo "<!DOCTYPE html>
<html>
<head>
    <title>SQL Injection Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .test-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
        .pass { color: green; font-weight: bold; }
        .fail { color: red; font-weight: bold; }
        .skip { color: #a66a00; font-weight: bold; }
        .info { background: #f0f0f0; padding: 10px; margin: 10px 0; }
        pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>SQL Injection Test Results</h1>
    <p class='info'>This script tests endpoints for SQL injection vulnerabilities. All endpoints should reject SQL injection attempts.</p>
    <p class='info'><strong>Note:</strong> A &quot;PASS&quot; here only means the response looked like a validation or error outcome (e.g. HTTP 4xx, or JSON error flags). This is heuristic — not a substitute for code review or prepared statements.</p>";

if ($session === null) {
    echo "<p class='info'><strong>Unauthenticated:</strong> API_TEST_LOGIN_EMAIL / API_TEST_LOGIN_PASSWORD are unset or login failed. Auth-gated endpoints below are skipped rather than credited with a false PASS.</p>";
}

$baseUrl = api_test_api_base_url();

$totalTests = 0;
$passedTests = 0;
$skippedTests = 0;

foreach ($testEndpoints as $endpoint) {
    echo "<div class='test-section'>";
    echo "<h2>{$endpoint['name']} ({$endpoint['field']})</h2>";

    if ($endpoint['requires_auth'] && $session === null) {
        $skippedTests += count($sqlPayloads);
        echo "<p><span class='skip'>SKIPPED</span> requires a logged-in session — set API_TEST_LOGIN_EMAIL / API_TEST_LOGIN_PASSWORD.</p>";
        echo "</div>";
        continue;
    }

    foreach ($sqlPayloads as $payload) {
        $totalTests++;
        $testData = $endpoint['data'];
        $testData[$endpoint['field']] = $payload;

        if ($endpoint['requires_auth'] && $session !== null) {
            $testData['csrf_token'] = $session['csrf_token'];
        }

        $ch = curl_init($baseUrl . $endpoint['url']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);

        if ($endpoint['encoding'] === 'multipart') {
            // An associative array makes cURL send real multipart/form-data,
            // matching what the browser sends — a JSON string would be
            // rejected with 415 before any field is validated.
            curl_setopt($ch, CURLOPT_POSTFIELDS, $testData);
        } else {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($testData));
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        }

        if ($endpoint['requires_auth'] && $session !== null) {
            curl_setopt($ch, CURLOPT_COOKIEJAR, $session['cookie_jar']);
            curl_setopt($ch, CURLOPT_COOKIEFILE, $session['cookie_jar']);
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $result = json_decode($response, true);

        // A 5xx means the query itself broke — the actual signature of an
        // unescaped/unparameterized query being derailed by the payload — so
        // it can never count as safe, regardless of body shape.
        //
        // A 4xx, or a body that explicitly says ok:false / success:false /
        // an "invalid ..." error, is a clean rejection.
        //
        // Endpoints that succeed with a bare array (e.g. search results) or
        // any other shape with no ok/success key at all are judged safe too:
        // there is no bypass signal to find. The only way a 2xx counts as
        // unsafe here is an *explicit* ok:true / success:true — i.e. the
        // endpoint treated the payload as a normal, accepted value when it
        // should have been rejected on its own terms (missing fields,
        // invalid category, etc).
        if ($httpCode >= 500) {
            $isSafe = false;
        } elseif ($httpCode >= 400) {
            $isSafe = true;
        } elseif (is_array($result)) {
            if ((isset($result['ok']) && $result['ok'] === false) ||
                (isset($result['success']) && $result['success'] === false) ||
                (isset($result['error']) && stripos((string) $result['error'], 'invalid') !== false)) {
                $isSafe = true;
            } elseif ((isset($result['ok']) && $result['ok'] === true) ||
                (isset($result['success']) && $result['success'] === true)) {
                $isSafe = false;
            } else {
                // No ok/success key either way (e.g. search's bare results
                // array) — a well-formed 2xx body with no bypass signal.
                $isSafe = true;
            }
        } else {
            // 2xx but not valid JSON — unexpected shape, don't call it safe.
            $isSafe = false;
        }

        if ($isSafe) {
            $passedTests++;
        }

        $status = $isSafe ? "<span class='pass'>PASS</span>" : "<span class='fail'>FAIL</span>";
        echo "<p>{$status} Payload: <code>" . escape_html($payload) . "</code></p>";

        if (!$isSafe) {
            echo "<pre>Response: " . escape_html($response) . "</pre>";
        }
    }

    echo "</div>";
}

$passRate = $totalTests > 0 ? round(($passedTests / $totalTests) * 100, 2) : 0;

echo "<div class='test-section'>";
echo "<h2>Summary</h2>";
echo "<p>Total Tests Run: {$totalTests}</p>";
echo "<p>Skipped (no authenticated session): {$skippedTests}</p>";
echo "<p>Passed: <span class='pass'>{$passedTests}</span></p>";
echo "<p>Failed: <span class='fail'>" . ($totalTests - $passedTests) . "</span></p>";
echo "<p>Pass Rate: {$passRate}%</p>";
echo "</div>";

echo "</body>
</html>";
