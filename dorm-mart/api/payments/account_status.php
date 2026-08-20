<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/stripe.php';

init_json_endpoint('GET');

try {
    $userId = require_login();
    $conn = db();
    $user = payment_user($conn, $userId);
    if (!$user) json_response(['success' => false, 'error' => 'User not found'], 404);

    $mode = payment_mode_for_protected((int)$user['is_protected'] === 1);
    $account = payment_account($conn, $userId, $mode);

    if (dm_payments_enabled() && $account && empty($account['disconnected_at'])) {
        try {
            $stripe = payment_stripe_client($mode);
            $remote = $stripe->v2->core->accounts->retrieve(
                (string)$account['stripe_account_id'],
                ['include' => ['configuration.merchant', 'requirements']]
            );
            $account = payment_upsert_account($conn, $userId, $mode, $remote->toArray());
        } catch (Throwable $e) {
            error_log('Stripe account status sync failed: user=' . $userId . ' mode=' . $mode . ' error=' . $e->getMessage());
        }
    }

    $connected = $account !== null && empty($account['disconnected_at']);
    json_response([
        'success' => true,
        'data' => [
            'feature_enabled' => dm_payments_enabled(),
            'payment_mode' => $mode,
            'is_test_mode' => $mode === 'test',
            'connected' => $connected,
            'details_submitted' => $connected && (int)$account['details_submitted'] === 1,
            'charges_enabled' => $connected && (int)$account['charges_enabled'] === 1,
            'payouts_enabled' => $connected && (int)$account['payouts_enabled'] === 1,
            'ready' => payment_account_ready($account),
            'dashboard_url' => $mode === 'test'
                ? 'https://dashboard.stripe.com/test/dashboard'
                : 'https://dashboard.stripe.com/',
        ],
    ]);
} catch (Throwable $e) {
    error_log('payment account status error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Unable to load payment settings'], 500);
}
