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
    if (!dm_payments_enabled()) {
        json_response(['success' => false, 'error' => 'Electronic payments are not enabled'], 503);
    }

    $conn = db();
    $user = payment_user($conn, $userId);
    if (!$user) json_response(['success' => false, 'error' => 'User not found'], 404);

    $mode = payment_mode_for_protected((int)$user['is_protected'] === 1);
    payment_require_https_for_live($mode);
    $stripe = payment_stripe_client($mode);
    $account = payment_account($conn, $userId, $mode);

    if ($account && empty($account['disconnected_at'])) {
        $remote = $stripe->v2->core->accounts->retrieve(
            (string)$account['stripe_account_id'],
            ['include' => ['configuration.merchant', 'requirements']]
        );
    } else {
        $displayName = trim((string)$user['first_name'] . ' ' . (string)$user['last_name']);
        $remote = $stripe->v2->core->accounts->create([
            'contact_email' => (string)$user['email'],
            'display_name' => $displayName !== '' ? $displayName : 'Dorm Mart seller',
            'dashboard' => 'full',
            'defaults' => [
                'currency' => 'usd',
                'profile' => [
                    'business_url' => dm_frontend_base_url(),
                    'product_description' => 'College marketplace sales through Dorm Mart',
                ],
                'responsibilities' => [
                    'fees_collector' => 'stripe',
                    'losses_collector' => 'stripe',
                ],
            ],
            'configuration' => [
                'merchant' => [
                    'capabilities' => [
                        'card_payments' => ['requested' => true],
                    ],
                ],
            ],
            'identity' => ['country' => 'us'],
            'metadata' => [
                'dorm_mart_user_id' => (string)$userId,
                'dorm_mart_mode' => $mode,
            ],
            'include' => ['configuration.merchant', 'requirements'],
        ], ['idempotency_key' => 'dorm-mart-account-v2-' . $mode . '-' . $userId]);
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

    $accountLink = $stripe->v2->core->accountLinks->create([
        'account' => $stripeAccountId,
        'use_case' => [
            'type' => 'account_onboarding',
            'account_onboarding' => [
                'collection_options' => ['fields' => 'eventually_due'],
                'configurations' => ['merchant'],
                'refresh_url' => dm_frontend_url('/app/setting/payments?stripe=refresh'),
                'return_url' => dm_frontend_url('/app/setting/payments?stripe=return'),
            ],
        ],
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
