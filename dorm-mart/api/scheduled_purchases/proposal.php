<?php
declare(strict_types=1);

// The rules for a seller's Scheduled Purchase proposal, kept free of the database
// so they can be tested directly. create.php reads the proposal, loads the listing
// and chat, then checks the listing-dependent terms before saving anything.

require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../payments/helpers.php';

const SCHEDULE_MEET_LOCATIONS = ['North Campus', 'South Campus', 'Ellicott', 'Other'];
const SCHEDULE_MEET_LOCATION_MAX_CHARS = 30;
const SCHEDULE_DESCRIPTION_MAX_CHARS = 1000;
const SCHEDULE_TRADE_DESCRIPTION_MAX_CHARS = 100;
const SCHEDULE_MAX_LEAD_TIME = '+3 months';
const SCHEDULE_MAX_NEGOTIATED_PRICE = 9999.99;

/**
 * Read and validate a proposal from the request body.
 *
 * Returns ['ok' => true, 'proposal' => [...]] or ['ok' => false, 'status' => int,
 * 'error' => string]. $now is the server clock, passed in so the meeting-time
 * window can be tested at its edges.
 */
function scheduled_purchase_read_proposal(array $payload, DateTimeImmutable $now, bool $paymentsEnabled): array
{
    $fail = static fn(string $error, int $status = 400): array => ['ok' => false, 'status' => $status, 'error' => $error];

    $description = $payload['description'] ?? '';
    if ($description !== null && !is_string($description)) return $fail('Invalid description');
    $description = trim((string)$description);
    if (mb_strlen($description) > SCHEDULE_DESCRIPTION_MAX_CHARS) return $fail('Description cannot exceed 1000 characters');

    $priceRaw = $payload['negotiated_price'] ?? null;
    $priceText = '';
    $negotiatedPrice = null;
    if ($priceRaw !== null && $priceRaw !== '') {
        $priceText = is_string($priceRaw) ? trim($priceRaw)
            : (is_int($priceRaw) || is_float($priceRaw) ? (string)$priceRaw : '');
        // Digits only, so the decimal value below is always finite and non-negative.
        if (!preg_match('/^(?:\d{1,10}(?:\.\d{1,2})?|\.\d{1,2})$/', $priceText)) return $fail('Invalid negotiated price');
        $negotiatedPrice = strict_decimal_value($priceText);
    }

    $isTrade = strict_boolean_value($payload['is_trade'] ?? false);
    if ($isTrade === null) return $fail('Invalid trade selection');

    $paymentOption = is_string($payload['payment_option'] ?? null) ? strtolower(trim($payload['payment_option'])) : 'manual';
    if (!in_array($paymentOption, ['manual', 'stripe'], true)) return $fail('Invalid payment option');
    $paymentAmountCents = null;
    if ($paymentOption === 'stripe') {
        if (!$paymentsEnabled) return $fail('Built-in payment is temporarily unavailable', 409);
        $paymentAmountCents = payment_amount_cents_from_value($payload['payment_amount'] ?? null);
        if ($paymentAmountCents === null) return $fail('Built-in payment amount must be between $0.50 and $9,999.99');
    }

    $tradeDescription = $payload['trade_item_description'] ?? null;
    if ($tradeDescription !== null && !is_string($tradeDescription)) return $fail('Invalid trade item description');
    $tradeDescription = $tradeDescription === null ? null : trim($tradeDescription);
    if ($tradeDescription !== null && mb_strlen($tradeDescription) > SCHEDULE_TRADE_DESCRIPTION_MAX_CHARS) {
        return $fail('Trade item description cannot exceed 100 characters');
    }

    $text = static fn(string $key): string => is_string($payload[$key] ?? null) ? trim($payload[$key]) : '';
    $meetLocation = $text('meet_location');
    if (array_key_exists('meet_location_choice', $payload) && $payload['meet_location_choice'] !== null) {
        $choice = $text('meet_location_choice');
        if (!is_string($payload['meet_location_choice']) || ($choice !== '' && !in_array($choice, SCHEDULE_MEET_LOCATIONS, true))) {
            return $fail('Invalid meet location choice');
        }
        if ($choice === 'Other') {
            $meetLocation = $text('custom_meet_location');
            if ($meetLocation === '') return $fail('Custom meet location is required');
        } elseif ($choice !== '') {
            $meetLocation = $choice;
        }
    }

    $inventoryId = request_int($payload, 'inventory_product_id');
    $conversationId = request_int($payload, 'conversation_id');
    $meetingAtRaw = $text('meeting_at');
    if ($inventoryId <= 0 || $conversationId <= 0 || $meetLocation === '' || $meetingAtRaw === '') {
        return $fail('Missing required fields');
    }
    // Characters, not bytes: the form allows 30, and "Café" is four.
    if (mb_strlen($meetLocation) > SCHEDULE_MEET_LOCATION_MAX_CHARS) return $fail('Meet location is too long');

    $meetingAt = strict_iso_datetime_value($meetingAtRaw);
    if ($meetingAt === null) return $fail('Invalid meeting date/time');
    if ($meetingAt > $now->modify(SCHEDULE_MAX_LEAD_TIME)) return $fail('Meeting date cannot be more than 3 months in advance');
    if ($meetingAt < $now) return $fail('Meeting date cannot be in the past');

    return ['ok' => true, 'proposal' => [
        'inventory_id' => $inventoryId,
        'conversation_id' => $conversationId,
        'meet_location' => $meetLocation,
        'meeting_at' => $meetingAt->setTimezone(new DateTimeZone('UTC')),
        'description' => $description,
        'negotiated_price' => $negotiatedPrice,
        'negotiated_price_text' => $priceText,
        'is_trade' => $isTrade,
        'trade_item_description' => $tradeDescription,
        'payment_option' => $paymentOption,
        'payment_amount_cents' => $paymentAmountCents,
    ]];
}

/**
 * Check the proposal against what the listing allows when it is scheduled.
 * Returns an error message, or null when the terms are acceptable.
 */
function scheduled_purchase_terms_error(array $proposal, bool $priceNegotiable, bool $acceptsTrades): ?string
{
    $price = $proposal['negotiated_price'];
    $isTrade = $proposal['is_trade'];
    if ($isTrade && $proposal['payment_option'] === 'stripe') return 'Built-in payment is not available for trades';
    if ($price !== null && !$priceNegotiable) return 'This item is not marked as price negotiable';
    if ($isTrade && !$acceptsTrades) return 'This item does not accept trades';
    if ($isTrade && $price !== null) return 'Cannot enter a price for a trade';
    if ($isTrade && ($proposal['trade_item_description'] ?? '') === '') {
        return 'Trade item description is required when trade is selected';
    }
    if ($price !== null && $price > SCHEDULE_MAX_NEGOTIATED_PRICE) return 'Negotiated price must be $9999.99 or less';
    if ($price !== null && price_has_blocked_digits($proposal['negotiated_price_text'])) return 'Invalid price value';
    return null;
}
