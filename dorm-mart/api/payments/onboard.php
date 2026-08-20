<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/stripe.php';

init_json_endpoint('POST');

try {
    $userId = require_login();
    $payload = json_request_body_or_error();
    require_csrf_token($payload['csrf_token'] ?? null);
    payment_require_feature();

    $conn = db();
    $user = payment_user($conn, $userId);
    if (!$user) json_response(['success' => false, 'error' => 'User not found'], 404);

    $mode = payment_mode_for_protected((int)$user['is_protected'] === 1);
    payment_require_https_for_live($mode);
    $stripe = payment_stripe_client($mode);
    $account = payment_account($conn, $userId, $mode);

    if ($account && empty($account['disconnected_at'])) {
        $remote = $stripe->accounts->retrieve((string)$account['stripe_account_id'], []);
    } else {
        $remote = $stripe->accounts->create([
            'country' => 'US',
            'email' => (string)$user['email'],
            'controller' => [
                'fees' => ['payer' => 'account'],
                'losses' => ['payments' => 'stripe'],
                'requirement_collection' => 'stripe',
                'stripe_dashboard' => ['type' => 'full'],
            ],
            'capabilities' => [
                'card_payments' => ['requested' => true],
            ],
            'business_profile' => [
                'url' => dm_frontend_base_url(),
            ],
            'metadata' => [
                'dorm_mart_user_id' => (string)$userId,
                'dorm_mart_mode' => $mode,
            ],
        ], ['idempotency_key' => 'dorm-mart-account-' . $mode . '-' . $userId]);
    }

    $account = payment_upsert_account($conn, $userId, $mode, $remote->toArray());
    $stripeAccountId = (string)$account['stripe_account_id'];

    $domainHost = payment_checkout_domain_host();
    if ($domainHost !== '' && !dm_is_local_host($domainHost)) {
        try {
            $stripe->paymentMethodDomains->create(
                ['domain_name' => $domainHost],
                payment_stripe_request_options($stripeAccountId, 'dorm-mart-domain-' . $mode . '-' . $stripeAccountId)
            );
        } catch (\Stripe\Exception\InvalidRequestException $e) {
            if (!str_contains(strtolower($e->getMessage()), 'already')) throw $e;
        }
    }

    $accountLink = $stripe->accountLinks->create([
        'account' => $stripeAccountId,
        'refresh_url' => dm_frontend_url('/app/setting/payments?stripe=refresh'),
        'return_url' => dm_frontend_url('/app/setting/payments?stripe=return'),
        'type' => 'account_onboarding',
    ]);

    json_response([
        'success' => true,
        'data' => [
            'url' => (string)$accountLink->url,
            'payment_mode' => $mode,
        ],
    ]);
} catch (Throwable $e) {
    error_log('payment onboarding error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Unable to start Stripe onboarding'], 500);
}
