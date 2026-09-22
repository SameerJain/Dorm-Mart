<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/promo_schedule.php';
require_once __DIR__ . '/../utility/transactional_email_html.php';

function check_promo(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

foreach ([
    ['2026-01-15 21:59:00Z', false],
    ['2026-01-15 22:00:00Z', true],
    ['2026-01-15 22:05:00Z', true],
    ['2026-01-15 23:00:00Z', false],
    ['2026-07-15 20:59:00Z', false],
    ['2026-07-15 21:00:00Z', true],
    ['2026-07-15 22:00:00Z', false],
] as [$time, $expected]) {
    check_promo(dm_promo_schedule(new DateTimeImmutable($time))['send_window'] === $expected, "send window at {$time}");
}

foreach (['2026-03-08', '2026-11-01', '2026-09-22'] as $date) {
    $now = new DateTimeImmutable("{$date} 17:00:00", new DateTimeZone('America/New_York'));
    $schedule = dm_promo_schedule($now);
    foreach (['daily' => 1, 'weekly' => 7] as $frequency => $days) {
        $lastSent = $now->modify("-{$days} days")->modify('+5 minutes')->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
        check_promo($lastSent < $schedule[$frequency . '_before'], "{$frequency} remains due across clock changes and execution delays on {$date}");
        $tooRecent = $now->modify('-' . ($days - 1) . ' days')->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
        check_promo($tooRecent >= $schedule[$frequency . '_before'], "{$frequency} does not send again too soon on {$date}");
    }
}

$package = dm_promotional_items_package('Test', [['title' => 'Desk', 'price' => 25, 'url' => 'https://example.com/item']]);
foreach (['html', 'text'] as $format) {
    check_promo(str_contains($package[$format], 'another student'), "{$format} uses student wording");
    check_promo(!str_contains(strtolower($package[$format]), 'another bull'), "{$format} has no Bull wording");
}
echo "PASS: Eastern send window, daily/weekly eligibility, DST, repeat prevention, and email copy\n";
