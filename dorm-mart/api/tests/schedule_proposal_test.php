<?php
declare(strict_types=1);

// Edges of the Scheduled Purchase proposal rules in api/scheduled_purchases/proposal.php.
// Pure checks with a fixed clock: no database, no network.

require_once __DIR__ . '/../scheduled_purchases/proposal.php';

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

$now = new DateTimeImmutable('2026-10-01T12:00:00Z');
$valid = [
    'inventory_product_id' => 7, 'conversation_id' => 9,
    'meeting_at' => '2026-10-02T12:00:00Z', 'meet_location' => 'North Campus',
];
$read = static fn(array $overrides, bool $payments = false): array =>
    scheduled_purchase_read_proposal(array_merge($valid, $overrides), $now, $payments);
$error = static fn(array $overrides, bool $payments = false): ?string => $read($overrides, $payments)['error'] ?? null;
$proposal = static fn(array $overrides, bool $payments = false): array => $read($overrides, $payments)['proposal'] ?? [];

// --- meeting time window --------------------------------------------------------
expect_same($read([])['ok'], true, 'a meeting tomorrow is accepted');
expect_same($read(['meeting_at' => '2026-10-01T12:00:00Z'])['ok'], true, 'a meeting at exactly now is accepted');
expect_same($error(['meeting_at' => '2026-10-01T11:59:59Z']), 'Meeting date cannot be in the past', 'one second ago is in the past');
expect_same($read(['meeting_at' => '2027-01-01T12:00:00Z'])['ok'], true, 'exactly three months ahead is accepted');
expect_same($error(['meeting_at' => '2027-01-01T12:00:01Z']), 'Meeting date cannot be more than 3 months in advance', 'one second past three months is refused');
expect_same($proposal(['meeting_at' => '2026-10-01T08:00:00-04:00'])['meeting_at']->format(DATE_ATOM), '2026-10-01T12:00:00+00:00',
    'an Eastern offset is compared and stored as UTC');
expect_same($error(['meeting_at' => '2026-10-02 12:00']), 'Invalid meeting date/time', 'a time without a zone is refused');

// --- required fields ------------------------------------------------------------
foreach (['inventory_product_id', 'conversation_id', 'meeting_at', 'meet_location'] as $field) {
    expect_same($error([$field => '']), 'Missing required fields', "$field is required");
}

// --- meet location ----------------------------------------------------------------
$thirtyChars = 'Café near Lockwood Library ok'; // 29 characters, 30 bytes
expect_same(mb_strlen($thirtyChars . '!'), 30, 'fixture is exactly 30 characters');
expect_same($proposal(['meet_location_choice' => 'Other', 'custom_meet_location' => $thirtyChars . '!'])['meet_location'] ?? null,
    $thirtyChars . '!', 'a 30-character place with an accent is accepted (characters, not bytes)');
expect_same($error(['meet_location_choice' => 'Other', 'custom_meet_location' => str_repeat('x', 31)]), 'Meet location is too long', '31 characters is too long');
expect_same($error(['meet_location_choice' => 'Other', 'custom_meet_location' => '  ']), 'Custom meet location is required', '"Other" needs a typed place');
expect_same($error(['meet_location_choice' => 'Mars']), 'Invalid meet location choice', 'only the listed campuses are choices');
expect_same($error(['meet_location_choice' => ['North Campus']]), 'Invalid meet location choice', 'a non-text choice is refused');
expect_same($proposal(['meet_location_choice' => 'Ellicott'])['meet_location'] ?? null, 'Ellicott', 'a listed choice replaces the free-text field');

// --- description and trades --------------------------------------------------------
expect_same($read(['description' => str_repeat('d', 1000)])['ok'], true, 'a 1000-character description is accepted');
expect_same($error(['description' => str_repeat('d', 1001)]), 'Description cannot exceed 1000 characters', '1001 characters is refused');
expect_same($error(['description' => ['x']]), 'Invalid description', 'a non-text description is refused');
expect_same($error(['is_trade' => 'yes']), 'Invalid trade selection', 'trade must be a real boolean');
expect_same($proposal(['is_trade' => '1'])['is_trade'] ?? null, true, '"1" counts as a trade');
expect_same($error(['trade_item_description' => str_repeat('t', 101)]), 'Trade item description cannot exceed 100 characters', 'trade description is capped');
expect_same($error(['trade_item_description' => 5]), 'Invalid trade item description', 'a non-text trade description is refused');

// --- negotiated price ---------------------------------------------------------------
expect_same($proposal(['negotiated_price' => '12.50'])['negotiated_price'] ?? null, 12.5, 'a two-decimal price is read');
expect_same($proposal(['negotiated_price' => 20])['negotiated_price'] ?? null, 20.0, 'a numeric price is read');
expect_same($proposal(['negotiated_price' => '.5'])['negotiated_price'] ?? null, 0.5, 'a leading-dot price is read');
foreach (['12.505', '-5', '1e3', ' ', 'twelve'] as $badPrice) {
    expect_same($error(['negotiated_price' => $badPrice]), 'Invalid negotiated price', "\"$badPrice\" is not a price");
}
expect_same($error(['negotiated_price' => true]), 'Invalid negotiated price', 'a boolean is not a price');
$plain = $proposal([]);
expect_same(array_key_exists('negotiated_price', $plain) && $plain['negotiated_price'] === null, true, 'no price means no negotiation');

// --- built-in payment ----------------------------------------------------------------
expect_same($read(['payment_option' => 'stripe', 'payment_amount' => '5.00'])['status'] ?? null, 409, 'Stripe is refused while payments are disabled');
expect_same($error(['payment_option' => 'stripe', 'payment_amount' => '0.49'], true), 'Built-in payment amount must be between $0.50 and $9,999.99', 'below the Stripe minimum is refused');
expect_same($proposal(['payment_option' => 'Stripe', 'payment_amount' => '0.50'], true)['payment_amount_cents'] ?? null, 50, 'the minimum is accepted, case-insensitively');
expect_same($error(['payment_option' => 'cash']), 'Invalid payment option', 'only manual and stripe are options');

// --- listing terms -----------------------------------------------------------------------
$terms = static fn(array $overrides, bool $negotiable = true, bool $trades = true): ?string =>
    scheduled_purchase_terms_error(array_merge($proposal([]), $overrides), $negotiable, $trades);
expect_same($terms([]), null, 'a plain proposal meets every listing');
expect_same($terms(['negotiated_price' => 10.0, 'negotiated_price_text' => '10'], false), 'This item is not marked as price negotiable', 'no price on a fixed-price listing');
expect_same($terms(['is_trade' => true, 'trade_item_description' => 'Lamp'], true, false), 'This item does not accept trades', 'no trade on a no-trades listing');
expect_same($terms(['is_trade' => true, 'trade_item_description' => 'Lamp', 'negotiated_price' => 5.0, 'negotiated_price_text' => '5']),
    'Cannot enter a price for a trade', 'a trade and a price are exclusive');
expect_same($terms(['is_trade' => true, 'trade_item_description' => '']), 'Trade item description is required when trade is selected', 'a trade says what is offered');
expect_same($terms(['is_trade' => true, 'trade_item_description' => 'Lamp', 'payment_option' => 'stripe']),
    'Built-in payment is not available for trades', 'a trade cannot be paid through Stripe');
expect_same($terms(['negotiated_price' => 9999.99, 'negotiated_price_text' => '9999.99']), null, 'the maximum price is allowed');
expect_same($terms(['negotiated_price' => 10000.0, 'negotiated_price_text' => '10000']), 'Negotiated price must be $9999.99 or less', 'one cent over the maximum is refused');
expect_same($terms(['negotiated_price' => 4.2, 'negotiated_price_text' => '4.20']), 'Invalid price value', 'the typed "4.20" is caught even though the float is 4.2');

echo "PASS: {$checks} schedule proposal checks\n";
