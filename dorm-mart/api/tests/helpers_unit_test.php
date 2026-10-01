<?php
declare(strict_types=1);

// Pure-function checks for shared API helpers. No database or network.

require_once __DIR__ . '/../helpers/contact_phone.php';
require_once __DIR__ . '/../helpers/file_stream.php';
require_once __DIR__ . '/../helpers/promo_unsubscribe.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../utility/transactional_email_html.php';

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

// --- promo unsubscribe tokens ---
$secret = 'test-secret';
$token = promo_unsubscribe_token(42, $secret);
expect_same(promo_unsubscribe_verify($token, $secret), 42, 'valid token verifies');
expect_same(promo_unsubscribe_verify($token, 'other-secret'), null, 'token from another secret rejected');
expect_same(promo_unsubscribe_verify('43' . substr($token, 2), $secret), null, 'user id swapped into a token rejected');
expect_same(promo_unsubscribe_verify('42.' . str_repeat('0', 64), $secret), null, 'forged signature rejected');
expect_same(promo_unsubscribe_verify('garbage', $secret), null, 'malformed token rejected');
expect_same(promo_unsubscribe_verify($token, ''), null, 'no secret configured rejects everything');

// --- digest package ---
$items = [
    ['title' => 'Desk lamp', 'price' => 0.0, 'url' => 'https://dormmart.me/#/app/viewProduct/1', 'image_url' => null],
    ['title' => 'Mini fridge', 'price' => 40.0, 'url' => 'https://dormmart.me/#/app/viewProduct/2', 'image_url' => 'https://dormmart.me/images/fridge.jpg'],
];
$withLink = dm_promotional_items_package('Ava', $items, 'https://dormmart.me/api/email/unsubscribe.php?token=x');
expect_same($withLink['headers']['List-Unsubscribe'] ?? null, '<https://dormmart.me/api/email/unsubscribe.php?token=x>', 'List-Unsubscribe header set');
expect_same($withLink['headers']['List-Unsubscribe-Post'] ?? null, 'List-Unsubscribe=One-Click', 'one-click header set');
expect_same(str_contains($withLink['text'], 'Desk lamp - Free'), true, '$0 items are labelled Free');
// The object-fit check only means something if an image was actually rendered.
expect_same(str_contains($withLink['html'], '<img src="https://dormmart.me/images/fridge.jpg"'), true, 'item image rendered');
expect_same(str_contains($withLink['html'], 'object-fit'), false, 'email images do not rely on object-fit');
$withoutLink = dm_promotional_items_package('Ava', $items);
expect_same(isset($withoutLink['headers']), false, 'no unsubscribe headers without a link');

// --- price_has_blocked_digits ---
expect_same(price_has_blocked_digits('12.50'), false, 'ordinary price is allowed');
expect_same(price_has_blocked_digits('4.20'), true, 'blocked digits are caught across the decimal point');
expect_same(price_has_blocked_digits('4.2'), false, 'the check reads the digits as typed');
expect_same(price_has_blocked_digits('$1,337.69'), true, 'formatting characters are ignored');

echo "PASS: {$checks} helper checks\n";
