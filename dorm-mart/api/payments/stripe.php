<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/app_config.php';

$paymentAutoload = dirname(__DIR__, 2) . '/vendor/autoload.php';
if (!is_readable($paymentAutoload)) {
    throw new RuntimeException('Composer dependencies are not installed');
}
require_once $paymentAutoload;

function payment_assert_mode(string $mode): string
{
    if (!in_array($mode, ['test', 'live'], true)) {
        throw new InvalidArgumentException('Invalid payment mode');
    }
    return $mode;
}

function payment_require_https_for_live(string $mode): void
{
    if ($mode !== 'live') return;
    $checkoutScheme = strtolower((string)parse_url(dm_stripe_checkout_domain(), PHP_URL_SCHEME));
    if (dm_request_scheme() !== 'https' || $checkoutScheme !== 'https') {
        throw new RuntimeException('Live electronic payments require HTTPS');
    }
}

function payment_method_configuration(string $mode): string
{
    $configuration = dm_stripe_payment_method_configuration(payment_assert_mode($mode));
    if ($configuration === '') {
        throw new RuntimeException('Stripe payment method configuration is not configured');
    }
    return $configuration;
}

function payment_stripe_client(string $mode): \Stripe\StripeClient
{
    payment_assert_mode($mode);
    $secret = dm_stripe_secret_key($mode);
    if ($secret === '') {
        throw new RuntimeException('Stripe is not configured for this payment mode');
    }
    if (!str_starts_with($secret, $mode === 'live' ? 'sk_live_' : 'sk_test_')) {
        throw new RuntimeException('Stripe secret key does not match the payment mode');
    }
    return new \Stripe\StripeClient($secret);
}

function payment_stripe_request_options(
    string $connectedAccountId,
    ?string $idempotencyKey = null
): array {
    $options = ['stripe_account' => $connectedAccountId];
    if ($idempotencyKey !== null && $idempotencyKey !== '') {
        $options['idempotency_key'] = $idempotencyKey;
    }
    return $options;
}

function payment_stripe_publishable_config(string $mode, string $connectedAccountId): array
{
    $key = dm_stripe_publishable_key(payment_assert_mode($mode));
    if ($key === '') {
        throw new RuntimeException('Stripe publishable key is not configured');
    }
    if (!str_starts_with($key, $mode === 'live' ? 'pk_live_' : 'pk_test_')) {
        throw new RuntimeException('Stripe publishable key does not match the payment mode');
    }
    return [
        'publishable_key' => $key,
        'connected_account_id' => $connectedAccountId,
    ];
}

function payment_checkout_domain_host(): string
{
    $url = dm_stripe_checkout_domain();
    $host = parse_url($url, PHP_URL_HOST);
    return is_string($host) ? strtolower(trim($host)) : '';
}
