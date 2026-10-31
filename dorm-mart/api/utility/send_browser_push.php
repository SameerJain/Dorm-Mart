<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../helpers/browser_push.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once dirname(__DIR__, 2) . '/vendor/autoload.php';
if (!browser_push_configured()) { fwrite(STDERR, "Set the three PUSH_VAPID_* settings before starting this worker.\n"); exit(1); }

$conn = db();
$send = browser_push_sender();
$watch = in_array('--watch', $argv, true);
do {
    $sent = browser_push_process($conn, $send);
    if ($sent > 0 || !$watch) echo "Sent {$sent} browser notifications.\n";
    if ($watch) sleep(2);
} while ($watch);
