<?php

declare(strict_types=1);

require_once __DIR__ . '/email.php';

const TWO_FACTOR_CODE_TTL_SECONDS = 600;
const TWO_FACTOR_MAX_ATTEMPTS = 5;

// How often a login may mint and email a fresh verification code. Set high enough
// that a genuine user retrying a mistyped code or a slow inbox never notices.
// Counted per account AND client IP, so someone who only knows the password
// cannot spend the owner's allowance and lock them out of receiving codes.
const TWO_FACTOR_MAX_CHALLENGES = 5;
const TWO_FACTOR_CHALLENGE_WINDOW_MINUTES = 15;
const TWO_FACTOR_CHALLENGE_LOCKOUT_MINUTES = 15;
// Account-wide ceiling across all IPs: still bounds inbox flooding and the total
// number of codes an attacker can guess at.
const TWO_FACTOR_MAX_CHALLENGES_PER_ACCOUNT = 20;
const TWO_FACTOR_ACCOUNT_WINDOW_MINUTES = 60;

// Turning 2FA on sends a confirmation email. Toggling it off and on again
// would otherwise send one every time, so cap those emails per account.
const TWO_FACTOR_ENABLE_EMAILS_PER_WINDOW = 3;
const TWO_FACTOR_ENABLE_WINDOW_MINUTES = 60;
const TWO_FACTOR_ENABLE_LOCKOUT_MINUTES = 60;

/** Throttle buckets for issuing codes: [this client, the whole account]. */
function two_factor_issue_keys(int $userId): array
{
    return [
        scoped_rate_limit_key('two_factor_issue_ip:' . rate_limit_client_ip(), $userId),
        scoped_rate_limit_key('two_factor_issue', $userId),
    ];
}

function create_two_factor_challenge(int $userId, string $theme): string
{
    $code = (string)random_int(100000, 999999);
    $_SESSION['two_factor_pending'] = [
        'user_id' => $userId,
        'code_hash' => password_hash($code, PASSWORD_DEFAULT),
        'expires_at' => time() + TWO_FACTOR_CODE_TTL_SECONDS,
        'attempts' => 0,
        'theme' => $theme,
    ];
    return $code;
}

function clear_two_factor_challenge(): void
{
    unset($_SESSION['two_factor_pending']);
}

function mask_two_factor_email(string $email): string
{
    [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');
    if ($domain === '') return $email;

    $visible = substr($local, 0, min(2, strlen($local)));
    return $visible . str_repeat('*', max(1, strlen($local) - strlen($visible))) . '@' . $domain;
}

function send_two_factor_email(array $user, array $package): array
{
    return dm_send_email([
        'firstName' => (string)($user['first_name'] ?? ''),
        'lastName' => (string)($user['last_name'] ?? ''),
        'email' => (string)($user['email'] ?? ''),
    ], $package);
}
