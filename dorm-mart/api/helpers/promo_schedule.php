<?php
declare(strict_types=1);

function dm_promo_schedule(DateTimeImmutable $now): array
{
    $eastern = $now->setTimezone(new DateTimeZone('America/New_York'));
    $today = $eastern->setTime(0, 0);
    $utc = new DateTimeZone('UTC');

    return [
        'send_window' => $eastern->format('H') === '17',
        'daily_before' => $today->setTimezone($utc)->format('Y-m-d H:i:s'),
        'weekly_before' => $today->modify('-6 days')->setTimezone($utc)->format('Y-m-d H:i:s'),
    ];
}
