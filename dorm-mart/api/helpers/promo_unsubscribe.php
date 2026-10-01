<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/app_config.php';

/**
 * Signed one-click unsubscribe links for promotional digests.
 *
 * A token is "<user id>.<hex HMAC-SHA256 of the id>" keyed by the
 * PROMO_UNSUBSCRIBE_SECRET environment variable. It only ever turns
 * promotional email off, so it carries no expiry: an old email's link should
 * keep working. Without the secret configured, no link is generated and the
 * email falls back to the Settings link.
 */

function promo_unsubscribe_secret(): string
{
    return dm_env_string('PROMO_UNSUBSCRIBE_SECRET');
}

function promo_unsubscribe_token(int $userId, string $secret): string
{
    return $userId . '.' . hash_hmac('sha256', 'promo-unsubscribe:' . $userId, $secret);
}

/** The user id a token was issued for, or null when it is malformed or forged. */
function promo_unsubscribe_verify(string $token, string $secret): ?int
{
    if ($secret === '' || !preg_match('/^([1-9]\d{0,18})\.([a-f0-9]{64})$/D', $token, $m)) {
        return null;
    }
    $userId = (int)$m[1];
    return hash_equals(promo_unsubscribe_token($userId, $secret), $token) ? $userId : null;
}

/** Absolute unsubscribe URL for a user, or null when unsubscribe links are not configured. */
function promo_unsubscribe_url(int $userId): ?string
{
    $secret = promo_unsubscribe_secret();
    if ($secret === '') {
        return null;
    }
    $url = dm_api_url('email/unsubscribe.php') . '?token=' . rawurlencode(promo_unsubscribe_token($userId, $secret));
    return str_starts_with($url, 'http') ? $url : null;
}
