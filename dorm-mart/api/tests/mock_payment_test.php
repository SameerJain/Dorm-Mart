<?php
declare(strict_types=1);

require __DIR__ . '/support/integration_harness.php';

// Even with real payments enabled, demo users must not need credentials or
// reach Stripe. The harness uses an isolated local database and disables mail.
putenv('PAYMENTS_ENABLED=true');
foreach (['TEST', 'LIVE'] as $mode) {
    foreach (['SECRET_KEY', 'PUBLISHABLE_KEY', 'WEBHOOK_SECRET', 'ACCOUNT_WEBHOOK_SECRET', 'PAYMENT_METHOD_CONFIGURATION'] as $setting) {
        putenv('STRIPE_' . $mode . '_' . $setting . '=');
    }
}
putenv('STRIPE_LIVE_WEBHOOK_SECRET=whsec_local_fixture');
harness_start('mockpayment', 5);
$conn->query('UPDATE user_accounts SET is_protected = 1 WHERE user_id IN (1,2)');

function mock_fixture(int $seller = 1, int $buyer = 2): array {
    global $conn;
    $conn->query("INSERT INTO INVENTORY (title, description, seller_id, item_condition, item_status, item_location, listing_price, price_nego, trades, photos)
                  VALUES ('Demo desk', 'A demo desk', $seller, 'Good', 'Active', 'North Campus', 25, 1, 0, '[\"/test.jpg\"]')");
    $product = (int)$conn->insert_id;
    $conn->query("INSERT INTO conversations (product_id, user1_id, user2_id) VALUES ($product, $seller, $buyer)");
    return [$product, (int)$conn->insert_id];
}

function mock_schedule(int $product, int $conversation, int $seller = 1, int $buyer = 2): int {
    $created = api($seller, 'scheduled_purchases/create.php', [
        'inventory_product_id' => $product, 'conversation_id' => $conversation,
        'meeting_at' => gmdate('c', time() + 3600), 'meet_location' => 'North Campus',
        'payment_option' => 'stripe', 'payment_amount' => '27.50',
        'payment_mode' => 'live', 'is_protected' => false,
    ]);
    if (!ok($created)) throw new RuntimeException('Schedule failed: ' . json_encode($created));
    $id = (int)$created['body']['data']['request_id'];
    if (!ok(api($buyer, 'scheduled_purchases/respond.php', ['request_id' => $id, 'action' => 'accept']))) {
        throw new RuntimeException('Schedule acceptance failed');
    }
    return $id;
}

function fixture_webhook(array $event, bool $validSignature = true): array {
    $body = json_encode($event);
    $timestamp = time();
    $signature = hash_hmac('sha256', $timestamp . '.' . $body, 'whsec_local_fixture');
    if (!$validSignature) $signature = str_repeat('0', 64);
    return harness_request(harness_guest('webhook'), 'payments/webhook_live.php', [
        CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', "Stripe-Signature: t=$timestamp,v1=$signature"],
    ]);
}

[$product, $conversation] = mock_fixture();
$eligibility = api(1, 'payments/schedule_eligibility.php', ['product_id' => $product, 'conversation_id' => $conversation]);
check(ok($eligibility) && ($eligibility['body']['data']['eligible'] ?? false) === true
    && ($eligibility['body']['data']['payment_mode'] ?? '') === 'mock', 'seed pair is eligible without any Stripe credentials');
if (empty($eligibility['body']['data']['eligible'])) harness_finish();

$account = api(1, 'payments/account_status.php', null);
check(ok($account) && ($account['body']['data']['is_mock'] ?? false), 'demo settings disclose mock payments without Stripe onboarding');
check(ok(api(1, 'payments/onboard.php')), 'seed onboarding never needs Stripe');
check(ok(api(1, 'payments/disconnect.php')), 'seed disconnect never needs Stripe');
$schedule = mock_schedule($product, $conversation);
check(row("SELECT payment_mode FROM scheduled_purchase_requests WHERE request_id=$schedule")['payment_mode'] === 'mock', 'client cannot force a seed schedule into live mode');
check(error_is(api(2, 'payments/create_intent.php', ['scheduled_request_id' => $schedule]), 409, 'The Payment Window is not open'), 'demo cannot pay before the scheduled time');
$conn->query("UPDATE scheduled_purchase_requests SET meeting_at=UTC_TIMESTAMP() - INTERVAL 10 SECOND WHERE request_id=$schedule");
$status = api(2, 'payments/status.php', ['conversation_id' => $conversation, 'product_id' => $product]);
check(ok($status) && ($status['body']['data']['can_pay'] ?? false) && ($status['body']['data']['is_mock'] ?? false), 'buyer can open mock checkout during the window');
check(api(harness_guest(), 'payments/create_intent.php', ['scheduled_request_id' => $schedule])['status'] === 401, 'checkout requires login');
check(api(2, 'payments/create_intent.php', ['scheduled_request_id' => $schedule, 'csrf_token' => 'forged'])['status'] === 403, 'checkout requires the session CSRF token');
check(api(1, 'payments/create_intent.php', ['scheduled_request_id' => $schedule])['status'] === 404, 'seller cannot pay as buyer');
check(api(3, 'payments/create_intent.php', ['scheduled_request_id' => $schedule])['status'] === 404, 'outsider cannot prepare payment');
$setup = api(2, 'payments/create_intent.php', ['scheduled_request_id' => $schedule]);
check(ok($setup) && ($setup['body']['data']['is_mock'] ?? false) && ($setup['body']['data']['amount_cents'] ?? 0) === 2750, 'mock checkout uses the server-locked amount');
check(!array_key_exists('client_secret', $setup['body']['data']) && !array_key_exists('publishable_key', $setup['body']['data']), 'mock checkout exposes no Stripe credentials');
$paymentId = (int)row("SELECT electronic_payment_id FROM electronic_payments WHERE scheduled_request_id=$schedule")['electronic_payment_id'];
check(ok(api(2, 'payments/create_intent.php', ['scheduled_request_id' => $schedule]))
    && (int)row("SELECT COUNT(*) AS n FROM electronic_payments WHERE scheduled_request_id=$schedule")['n'] === 1, 'repeated checkout creates one mock payment');
check(api(3, 'payments/mock_confirm.php', ['scheduled_request_id' => $schedule])['status'] === 404, 'outsider cannot complete mock checkout');
check(api(2, 'payments/mock_confirm.php', ['scheduled_request_id' => $schedule, 'csrf_token' => 'forged'])['status'] === 403, 'mock completion requires CSRF');
$completed = api(2, 'payments/mock_confirm.php', ['scheduled_request_id' => $schedule, 'amount_cents' => 1, 'payment_mode' => 'live']);
check(ok($completed) && ($completed['body']['data']['completed'] ?? false), 'mock transaction completes without Stripe');
check(row("SELECT payment_mode,status,amount_cents FROM electronic_payments WHERE electronic_payment_id=$paymentId") === ['payment_mode' => 'mock', 'status' => 'succeeded', 'amount_cents' => '2750'], 'forged mode and amount do not change the recorded mock payment');
check((int)row("SELECT sold FROM INVENTORY WHERE product_id=$product")['sold'] === 1, 'mock completion marks the listing sold');
check(ok(api(2, 'payments/mock_confirm.php', ['scheduled_request_id' => $schedule]))
    && (int)row("SELECT COUNT(*) AS n FROM confirm_purchase_requests WHERE scheduled_request_id=$schedule")['n'] === 1, 'repeated mock completion does not duplicate confirmation');
$receipt = api(2, 'receipt/view_receipt.php?product_id=' . $product, null);
$receiptText = json_encode($receipt['body']);
check(ok($receipt) && str_contains($receiptText, '"completion_source":"mock"') && str_contains($receiptText, '"payment_mode":"mock"'), 'receipt identifies the mock transaction');
$history = api(2, 'purchase_history/purchase_history.php');
check(ok($history) && str_contains(json_encode($history['body']), '"payment_mode":"mock"'), 'purchase history preserves the mock label');
check((float)(api(1, 'seller_dashboard/seller_stats.php', null)['body']['data']['earnings'] ?? -1) === 0.0, 'mock payments do not count as real earnings');
check(api(2, 'payments/refund.php', ['electronic_payment_id' => $paymentId])['status'] === 404, 'buyer cannot issue a seller refund');
check(ok(api(1, 'payments/refund.php', ['electronic_payment_id' => $paymentId, 'relist' => true])), 'seller can issue a keyless mock refund');
check(row("SELECT status FROM electronic_payments WHERE electronic_payment_id=$paymentId")['status'] === 'refunded'
    && (int)row("SELECT sold FROM INVENTORY WHERE product_id=$product")['sold'] === 0, 'mock refund records the refund and relists when requested');
check(api(1, 'payments/refund.php', ['electronic_payment_id' => $paymentId])['status'] === 409, 'already refunded payment cannot be refunded again');
check(api(2, 'payments/mock_confirm.php', ['scheduled_request_id' => $schedule])['status'] === 409, 'refunded mock payment cannot be paid again');

foreach ([[1,5], [4,2], [4,5]] as [$seller, $buyer]) {
    [$item, $chat] = mock_fixture($seller, $buyer);
    $availability = api($seller, 'payments/schedule_eligibility.php', ['product_id' => $item, 'conversation_id' => $chat]);
    $data = $availability['body']['data'] ?? [];
    check(ok($availability) && ($seller === 4 && $buyer === 5 ? empty($data['eligible']) : ($data['payment_mode'] ?? '') === 'mock'), "pair $seller/$buyer uses mock if either account is protected; real pairs need keys");
}
[$item, $chat] = mock_fixture();
$expired = mock_schedule($item, $chat);
$conn->query("UPDATE scheduled_purchase_requests SET meeting_at=UTC_TIMESTAMP() - INTERVAL 31 MINUTE WHERE request_id=$expired");
check(api(2, 'payments/mock_confirm.php', ['scheduled_request_id' => $expired])['status'] === 409, 'mock completion refuses an expired Payment Window');

[$item, $chat] = mock_fixture();
$forged = mock_schedule($item, $chat);
$conn->query("UPDATE scheduled_purchase_requests SET meeting_at=UTC_TIMESTAMP() - INTERVAL 10 SECOND, payment_mode='live' WHERE request_id=$forged");
check(api(2, 'payments/create_intent.php', ['scheduled_request_id' => $forged])['status'] === 409, 'even a stored live-mode schedule cannot send a protected user to Stripe');
check(api(2, 'payments/mock_confirm.php', ['scheduled_request_id' => $forged])['status'] === 409, 'mock endpoint refuses a schedule stored as live');

$event = ['id' => 'evt_seed_guard', 'object' => 'event', 'type' => 'payment_intent.succeeded',
    'livemode' => true, 'created' => time(), 'account' => 'acct_fixture', 'data' => ['object' => [
        'id' => 'pi_seed_guard', 'object' => 'payment_intent', 'amount_received' => 2750, 'currency' => 'usd',
        'metadata' => ['scheduled_request_id' => (string)$forged],
    ]]];
check(ok(fixture_webhook($event)) && (int)row("SELECT COUNT(*) AS n FROM electronic_payments WHERE scheduled_request_id=$forged")['n'] === 0,
    'even a signed live webhook cannot fulfill or refund a seed transaction');
check(fixture_webhook($event, false)['status'] === 400, 'a forged webhook signature is rejected');
$conn->query("INSERT INTO electronic_payments (scheduled_request_id,seller_user_id,buyer_user_id,payment_mode,amount_cents,
    stripe_connected_account_id,stripe_payment_intent_id,status) VALUES ($forged,1,2,'live',2750,'acct_fixture','pi_seed_guard','succeeded')");
$legacy = (int)$conn->insert_id;
check(api(1, 'payments/refund.php', ['electronic_payment_id' => $legacy])['status'] === 409, 'seed seller cannot send even a legacy live refund to Stripe');
check(api(4, 'payments/onboard.php')['status'] === 503, 'missing real credentials produces an unavailable response instead of a backend error');

// Exercise the real webhook's completion rules using signed local fixtures.
// No Stripe request is sent: these are isolated database records, not charges.
[$item, $chat] = mock_fixture(4, 5);
$conn->query("INSERT INTO scheduled_purchase_requests (inventory_product_id,seller_user_id,buyer_user_id,conversation_id,
    meet_location,meeting_at,verification_code,status,payment_option,payment_mode,payment_amount_cents)
    VALUES ($item,4,5,$chat,'North Campus',UTC_TIMESTAMP() - INTERVAL 10 SECOND,'LIVE','accepted','stripe','live',2500)");
$realSchedule = (int)$conn->insert_id;
$conn->query("INSERT INTO electronic_payments (scheduled_request_id,seller_user_id,buyer_user_id,payment_mode,amount_cents,
    stripe_connected_account_id,stripe_payment_intent_id,status) VALUES ($realSchedule,4,5,'live',2500,'acct_fixture','pi_fixture_live','processing')");
$event['id'] = 'evt_fixture_live';
$event['data']['object'] = ['id' => 'pi_fixture_live', 'object' => 'payment_intent', 'amount_received' => 2500,
    'currency' => 'usd', 'metadata' => ['scheduled_request_id' => (string)$realSchedule]];
check(ok(fixture_webhook($event)) && (int)row("SELECT sold FROM INVENTORY WHERE product_id=$item")['sold'] === 1,
    'signed Stripe success fixture completes an eligible non-demo purchase');
check(ok(fixture_webhook($event)) && (int)row("SELECT COUNT(*) AS n FROM confirm_purchase_requests WHERE scheduled_request_id=$realSchedule")['n'] === 1,
    'replayed Stripe success webhook completes the purchase only once');

require_once __DIR__ . '/../database/protect_test_accounts.php';
$seedEmail = seed_account_emails()[0];
$stmt = $conn->prepare('UPDATE user_accounts SET email = ?, is_protected = 0 WHERE user_id = 4');
$stmt->bind_param('s', $seedEmail);
$stmt->execute();
$stmt->close();
[$seedItem, $seedChat] = mock_fixture(4, 5);
$seedSchedule = mock_schedule($seedItem, $seedChat, 4, 5);
check(row("SELECT payment_mode FROM scheduled_purchase_requests WHERE request_id=$seedSchedule")['payment_mode'] === 'mock',
    'fixture email still forces mock mode even if its protection flag is missing');
$conn->query("UPDATE scheduled_purchase_requests SET meeting_at=UTC_TIMESTAMP() - INTERVAL 10 SECOND WHERE request_id=$seedSchedule");
check(ok(api(5, 'payments/create_intent.php', ['scheduled_request_id' => $seedSchedule]))
    && ok(api(5, 'payments/mock_confirm.php', ['scheduled_request_id' => $seedSchedule])),
    'fixture email with a missing flag can complete only a mock transaction');

harness_cleanup();
putenv('PAYMENTS_ENABLED=false');
harness_start('mockdisabled', 2);
$conn->query('UPDATE user_accounts SET is_protected = 1 WHERE user_id IN (1,2)');
[$item, $chat] = mock_fixture();
$disabledSchedule = mock_schedule($item, $chat);
$conn->query("UPDATE scheduled_purchase_requests SET meeting_at=UTC_TIMESTAMP() - INTERVAL 10 SECOND WHERE request_id=$disabledSchedule");
check(ok(api(2, 'payments/create_intent.php', ['scheduled_request_id' => $disabledSchedule])), 'mock checkout works with real payments switched off');
check(ok(api(2, 'payments/mock_confirm.php', ['scheduled_request_id' => $disabledSchedule])), 'mock completion works with real payments switched off');
$disabledPayment = (int)row("SELECT electronic_payment_id FROM electronic_payments WHERE scheduled_request_id=$disabledSchedule")['electronic_payment_id'];
check(ok(api(1, 'payments/refund.php', ['electronic_payment_id' => $disabledPayment])), 'mock refund works with real payments switched off');
harness_finish();
