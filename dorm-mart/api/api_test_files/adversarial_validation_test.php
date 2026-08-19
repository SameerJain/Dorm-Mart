<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../helpers/image_upload.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$checks = 0;

function expect_value($actual, $expected, string $message): void
{
    global $checks;
    $checks++;
    if ($actual !== $expected) {
        fwrite(STDERR, "FAIL: {$message}\nExpected: " . var_export($expected, true)
            . "\nActual: " . var_export($actual, true) . "\n");
        exit(1);
    }
}

foreach ([42, '42', 0, '-42'] as $value) {
    expect_value(strict_integer_value($value), (int)$value, 'valid integer rejected');
}
foreach (['1abc', '1.0', '01', '', ' 1', true, false, 1.0, [], PHP_INT_MAX . '0'] as $value) {
    expect_value(strict_integer_value($value), null, 'malformed integer accepted');
}

foreach ([0, 5, 0.5, '0.50', '.5', '-1.25'] as $value) {
    expect_value(strict_decimal_value($value), (float)$value, 'valid decimal rejected');
}
foreach (['1abc', '1e3', '', '.', ' 1', true, [], INF, NAN] as $value) {
    expect_value(strict_decimal_value($value), null, 'malformed decimal accepted');
}

foreach ([[true, true], [false, false], [1, true], [0, false], ['1', true], ['0', false]] as [$value, $expected]) {
    expect_value(strict_boolean_value($value), $expected, 'valid boolean rejected');
}
foreach (['true', 'false', 'yes', '', 2, -1, [], null] as $value) {
    expect_value(strict_boolean_value($value), null, 'malformed boolean accepted');
}

expect_value(decode_json_object('{"name":"test","nested":{"ok":true}}')['name'] ?? null, 'test', 'JSON object rejected');
foreach (['[]', '"text"', 'null', 'true', '{bad json}', '', str_repeat('x', MAX_JSON_REQUEST_BYTES + 1)] as $json) {
    expect_value(decode_json_object($json), null, 'non-object or malformed JSON accepted');
}

foreach (['2026-08-20T12:00:00Z', '2026-08-20T12:00:00.123456-04:00'] as $value) {
    expect_value(strict_iso_datetime_value($value) instanceof DateTimeImmutable, true, 'valid ISO datetime rejected');
}
foreach (['tomorrow', '2026-02-30T12:00:00Z', '2026-08-20 12:00:00', '2026-08-20T12:00:00', [], null] as $value) {
    expect_value(strict_iso_datetime_value($value), null, 'malformed datetime accepted');
}

$knownImage = dirname(__DIR__, 2) . '/images/air-fryer.jpg';
if (is_file($knownImage)) {
    expect_value(uploaded_image_dimensions_are_safe($knownImage, 'image/jpeg'), true, 'known image rejected');
}
expect_value(uploaded_image_dimensions_are_safe(dirname(__DIR__, 2) . '/package.json', 'image/jpeg'), false, 'non-image accepted');

echo "Adversarial backend validation passed: {$checks} checks\n";
