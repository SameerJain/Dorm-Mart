<?php
/**
 * XSS Injection Test Script
 * Tests endpoint responses for unsafe XSS reflection.
 *
 * Every endpoint below requires a logged-in session. Set API_TEST_LOGIN_EMAIL /
 * API_TEST_LOGIN_PASSWORD to a real account before running this script, or every
 * check is skipped (and reported as skipped) instead of recording an
 * unauthenticated 401 as a false "PASS" that never touched the field it claims
 * to test.
 *
 * Usage: Run this script from command line or via web browser
 */

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__, 2) . '/security/security.php';
set_security_headers();

header('Content-Type: text/html; charset=utf-8');

$session = api_test_login_session();

// Test payloads for XSS
$xssPayloads = [
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert('XSS')>",
    "<svg onload=alert('XSS')>",
    "javascript:alert('XSS')",
    "<iframe src=javascript:alert('XSS')>",
    "<body onload=alert('XSS')>",
    "<input onfocus=alert('XSS') autofocus>",
    "<select onfocus=alert('XSS') autofocus>",
    "<textarea onfocus=alert('XSS') autofocus>",
    "<keygen onfocus=alert('XSS') autofocus>",
    "<video><source onerror=alert('XSS')>",
    "<audio src=x onerror=alert('XSS')>",
    "<details open ontoggle=alert('XSS')>",
    "<marquee onstart=alert('XSS')>",
    "<div onmouseover=alert('XSS')>",
    "<style>@import'javascript:alert(\"XSS\")';</style>",
    "<link rel=stylesheet href=javascript:alert('XSS')>",
    "<meta http-equiv=refresh content=0;url=javascript:alert('XSS')>",
    "<object data=javascript:alert('XSS')>",
    "<embed src=javascript:alert('XSS')>",
];

// Test endpoints. 'encoding' controls how the payload is sent: product_listing.php
// only accepts multipart/form-data (it rejects JSON with HTTP 415 before it ever
// looks at title/description), so sending JSON against it "passes" for a reason
// that has nothing to do with XSS handling. Every endpoint here also requires a
// logged-in session ('requires_auth'), so without real credentials the request
// never reaches the field being tested either.
$testEndpoints = [
    [
        'name' => 'Create Message',
        'url' => '/chat/create_message.php',
        'data' => ['receiver_id' => '1', 'content' => '', 'conv_id' => null],
        'field' => 'content',
        'encoding' => 'json',
        'requires_auth' => true,
    ],
    [
        'name' => 'Submit Review',
        'url' => '/reviews/submit_review.php',
        'data' => ['product_id' => 1, 'rating' => 5, 'product_rating' => 5, 'review_text' => ''],
        'field' => 'review_text',
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
    [
        'name' => 'Product Listing (Description)',
        'url' => '/seller_dashboard/product_listing.php',
        'data' => ['mode' => 'create', 'title' => 'Test', 'description' => '', 'price' => '10'],
        'field' => 'description',
        'encoding' => 'multipart',
        'requires_auth' => true,
    ],
    [
        'name' => 'Update Profile (Bio)',
        'url' => '/profile/update_profile.php',
        'data' => ['bio' => ''],
        'field' => 'bio',
        'encoding' => 'json',
        'requires_auth' => true,
    ],
    [
        'name' => 'Search Query',
        'url' => '/search/get_search_items.php',
        'data' => ['q' => ''],
        'field' => 'q',
        'encoding' => 'json',
        'requires_auth' => true,
    ],
];

echo "<!DOCTYPE html>
<html>
<head>
    <title>XSS Injection Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .test-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
        .pass { color: green; font-weight: bold; }
        .fail { color: red; font-weight: bold; }
        .skip { color: #a66a00; font-weight: bold; }
        .info { background: #f0f0f0; padding: 10px; margin: 10px 0; }
        pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
        .payload { font-family: monospace; background: #f9f9f9; padding: 2px 5px; }
    </style>
</head>
<body>
    <h1>XSS Injection Test Results</h1>
    <p class='info'>This script checks that XSS-looking payloads are not reflected as executable HTML. Endpoints may reject payloads or accept them as plain text.</p>
    <p class='info'><strong>Note:</strong> JSON responses may contain user text safely. Stored XSS still depends on escaped rendering in the React app.</p>";

if ($session === null) {
    echo "<p class='info'><strong>Unauthenticated:</strong> API_TEST_LOGIN_EMAIL / API_TEST_LOGIN_PASSWORD are unset or login failed. Every endpoint below requires login, so all checks are skipped rather than credited with a false PASS.</p>";
}

$baseUrl = api_test_api_base_url();

$totalTests = 0;
$passedTests = 0;
$skippedTests = 0;

foreach ($testEndpoints as $endpoint) {
    echo "<div class='test-section'>";
    echo "<h2>{$endpoint['name']} ({$endpoint['field']})</h2>";

    if ($endpoint['requires_auth'] && $session === null) {
        $skippedTests += count($xssPayloads);
        echo "<p><span class='skip'>SKIPPED</span> requires a logged-in session — set API_TEST_LOGIN_EMAIL / API_TEST_LOGIN_PASSWORD.</p>";
        echo "</div>";
        continue;
    }

    foreach ($xssPayloads as $payload) {
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
        $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: '';
        $curlError = curl_error($ch);
        curl_close($ch);

        $responseBody = is_string($response) ? $response : '';
        $result = json_decode($responseBody, true);
        $isRejected = $httpCode >= 400 ||
            (isset($result['ok']) && $result['ok'] === false) ||
            (isset($result['success']) && $result['success'] === false);
        $isHtmlResponse = stripos($contentType, 'text/html') !== false;
        $unsafeReflection = $isHtmlResponse && $responseBody !== '' && strpos($responseBody, $payload) !== false;
        $isSafe = $response !== false && ($isRejected || !$unsafeReflection);

        if ($isSafe) {
            $passedTests++;
        }

        if ($response === false) {
            $reason = 'curl error';
        } elseif ($isRejected) {
            $reason = 'rejected by endpoint';
        } elseif ($unsafeReflection) {
            $reason = 'unsafe raw HTML reflection';
        } else {
            $reason = 'no unsafe HTML reflection';
        }

        $status = $isSafe ? "<span class='pass'>PASS</span>" : "<span class='fail'>FAIL</span>";
        echo "<p>{$status} " . escape_html($reason) . " - Payload: <span class='payload'>" . escape_html($payload) . "</span></p>";

        if (!$isSafe) {
            $detail = $response === false ? $curlError : substr($responseBody, 0, 500);
            echo "<pre>Response: " . escape_html($detail) . "</pre>";
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
echo "<p class='info'><strong>Note:</strong> Accepted payloads are okay when rendered as text/JSON and escaped in any HTML context.</p>";
echo "</div>";

echo "</body>
</html>";
