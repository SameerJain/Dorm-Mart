<?php

require_once __DIR__ . '/email.php';

/** Send the promotional welcome email, or `$package` in its place. */
function send_promo_welcome_email(array $user, ?array $package = null): array
{
    return dm_send_email($user, $package ?? dm_transactional_promo_welcome_package($user['firstName'] ?? ''));
}
