<?php

declare(strict_types=1);

require_once __DIR__ . '/promo_email.php';

const TWO_FACTOR_CODE_TTL_SECONDS = 600;
const TWO_FACTOR_MAX_ATTEMPTS = 5;

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
    return send_promo_welcome_email([
        'firstName' => (string)($user['first_name'] ?? ''),
        'lastName' => (string)($user['last_name'] ?? ''),
        'email' => (string)($user['email'] ?? ''),
    ], $package);
}
