<?php
declare(strict_types=1);

// Pure-function checks for shared API helpers. No database or network.

require_once __DIR__ . '/../helpers/contact_phone.php';
require_once __DIR__ . '/../helpers/file_stream.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$checks = 0;

function expect_same($actual, $expected, string $message): void
{
    global $checks;
    $checks++;
    if ($actual !== $expected) {
        fwrite(STDERR, "FAIL: {$message}\nExpected: " . var_export($expected, true)
            . "\nActual: " . var_export($actual, true) . "\n");
        exit(1);
    }
}

// --- normalize_contact_phone ---
expect_same(normalize_contact_phone(''), null, 'blank phone clears the number');
expect_same(normalize_contact_phone('   '), null, 'whitespace phone clears the number');
foreach (['7165551234', '(716) 555-1234', '716.555.1234', '+1 716 555 1234', '1-716-555-1234'] as $input) {
    expect_same(normalize_contact_phone($input), '(716) 555-1234', "phone {$input} normalized");
}
foreach (['1', '+', '((((1', '716555123', '27165551234', '716-555-12345', 'call me', '716555123x'] as $input) {
    expect_same(normalize_contact_phone($input), false, "phone {$input} rejected");
}

// --- parse_byte_range ---
expect_same(parse_byte_range(null, 1000), null, 'no Range header serves the whole file');
expect_same(parse_byte_range('bytes=0-99', 1000), [0, 99], 'explicit range');
expect_same(parse_byte_range('bytes=500-', 1000), [500, 999], 'open-ended range');
expect_same(parse_byte_range('bytes=-100', 1000), [900, 999], 'suffix range');
expect_same(parse_byte_range('bytes=-5000', 1000), [0, 999], 'suffix larger than file');
expect_same(parse_byte_range('bytes=900-5000', 1000), [900, 999], 'end clamped to file size');
expect_same(parse_byte_range('bytes=0-1', 1000), [0, 1], 'Safari probe range');
expect_same(parse_byte_range('bytes=1000-', 1000), false, 'start past end is unsatisfiable');
expect_same(parse_byte_range('bytes=50-10', 1000), false, 'reversed range is unsatisfiable');
expect_same(parse_byte_range('bytes=-0', 1000), false, 'empty suffix is unsatisfiable');
expect_same(parse_byte_range('bytes=0-1,5-9', 1000), null, 'multi-range falls back to full file');
expect_same(parse_byte_range('items=0-1', 1000), null, 'non-byte unit ignored');
expect_same(parse_byte_range('bytes=-', 1000), null, 'empty range ignored');
expect_same(parse_byte_range('bytes=0-10', 0), null, 'empty file served whole');

echo "PASS: {$checks} helper checks\n";
