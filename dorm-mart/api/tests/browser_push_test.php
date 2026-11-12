<?php
declare(strict_types=1);
require __DIR__ . '/support/integration_harness.php';
require __DIR__ . '/../helpers/browser_push.php';
require __DIR__ . '/../helpers/notifications.php';
require dirname(__DIR__, 2) . '/vendor/autoload.php';
// Public test fixture, never used for a real push service.
$keys = json_decode(file_get_contents(__DIR__ . '/fixtures/push_keys.json'), true);
putenv('PUSH_VAPID_PUBLIC_KEY=' . $keys['publicKey']);
putenv('PUSH_VAPID_PRIVATE_KEY=' . $keys['privateKey']);
putenv('PUSH_VAPID_SUBJECT=mailto:test@example.com');
harness_start('browserpush', 2);
$path = 'push/subscription.php';
$subscription = ['endpoint' => 'https://fcm.googleapis.com/fcm/send/test-device', 'keys' => [
    'p256dh' => $keys['publicKey'], 'auth' => rtrim(strtr(base64_encode(random_bytes(16)), '+/', '-_'), '='),
]];
check(api(harness_guest(), $path, null)['status'] === 401, 'push configuration requires login');
$configuration = api(1, $path, null)['body'];
check(($configuration['data']['configured'] ?? false) === true, 'public configuration is available');
check(!str_contains(json_encode($configuration), $keys['privateKey']), 'configuration never exposes the private signing key');
check(api(1, $path, ['subscription' => $subscription, 'csrf_token' => 'bad'])['status'] === 403, 'subscription writes require CSRF');
foreach (['http://fcm.googleapis.com/test', 'https://127.0.0.1/test', 'https://fcm.googleapis.com.evil.test/test', 'https://user@fcm.googleapis.com/test', 'https://fcm.googleapis.com:444/test'] as $endpoint) {
    $bad = array_replace($subscription, ['endpoint' => $endpoint]);
    check(api(1, $path, ['subscription' => $bad])['status'] === 400, 'untrusted push endpoint is rejected');
}
check(api(1, $path, ['subscription' => ['endpoint' => $subscription['endpoint'], 'keys' => ['p256dh' => 'bad', 'auth' => 'bad']]])['status'] === 400, 'malformed encryption keys are rejected');
$saved = api(1, $path, ['subscription' => $subscription]);
check(ok($saved), 'browser subscription can be saved: ' . json_encode($saved['body']));
check(ok(api(1, $path, ['subscription' => $subscription])), 'saving the same browser is idempotent');
check((int)row('SELECT COUNT(*) AS n FROM browser_push_subscriptions')['n'] === 1, 'one browser does not create duplicate subscriptions');
check(ok(api(2, $path, ['action' => 'unsubscribe', 'endpoint' => $subscription['endpoint']])), 'another user cannot unsubscribe this browser');
check((int)row('SELECT COUNT(*) AS n FROM browser_push_subscriptions')['n'] === 1, 'subscription ownership is preserved');
$conn->query("INSERT INTO INVENTORY (title,seller_id,listing_price,item_status) VALUES ('Push desk',1,25,'Active')");
$product = $conn->insert_id;
$conv = api(2, 'chat/ensure_conversation.php', ['product_id' => $product])['body']['conv_id'];
// Ignore the intro card: the following assertions target the explicit message.
$conn->query('DELETE FROM browser_push_queue');
check(ok(api(2, 'chat/create_message.php', ['conv_id' => $conv, 'receiver_id' => 1, 'content' => 'Private message text'])), 'sending a message queues push');
$queued = row('SELECT * FROM browser_push_queue');
check((int)($queued['message_id'] ?? 0) > 0, 'message push is durably queued');
check(!str_contains($queued['payload'] ?? '', 'Private message text'), 'push does not expose private message previews');
$sent = [];
$sender = static function (array $sub, string $payload) use (&$sent): array {
    $sent[] = json_decode($payload, true);
    return ['success' => true, 'expired' => false];
};
browser_push_process($conn, $sender);
check(count($sent) === 1 && $sent[0]['path'] === '/app/chat?conv=' . $conv, 'worker delivers an internal chat destination');
browser_push_process($conn, $sender);
check(count($sent) === 1, 'successful deliveries are not sent again');
$event = ['recipient_user_id' => 1, 'type' => 'schedule_accepted', 'title' => 'A private title', 'message' => 'Private purchase details', 'destination' => '/app/seller-dashboard/ongoing-purchases', 'idempotency_key' => 'push-schedule-test'];
notification_insert($conn, $event);
notification_insert($conn, $event);
check((int)row('SELECT COUNT(*) AS n FROM browser_push_queue')['n'] === 1, 'purchase notification duplicates do not enqueue twice');
browser_push_process($conn, $sender);
check(count($sent) === 2 && $sent[1]['title'] === 'Purchase update', 'purchase updates reach the browser');
$conn->begin_transaction();
notification_insert($conn, array_replace($event, ['idempotency_key' => 'rolled-back-push']));
$conn->rollback();
check((int)row('SELECT COUNT(*) AS n FROM browser_push_queue')['n'] === 0, 'rolled-back purchases cannot send push');
notification_insert($conn, array_replace($event, ['idempotency_key' => 'future-push', 'available_at' => gmdate('Y-m-d H:i:s', time() + 3600)]));
$conn->query('UPDATE browser_push_queue SET created_at = UTC_TIMESTAMP() - INTERVAL 2 DAY');
browser_push_process($conn, $sender);
check(count($sent) === 2, 'future reminders are not sent early');
check((int)row('SELECT COUNT(*) AS n FROM browser_push_queue')['n'] === 1, 'future reminders survive queue cleanup even when created days ago');
$conn->query('UPDATE browser_push_queue SET available_at = UTC_TIMESTAMP()');
browser_push_process($conn, static fn() => ['success' => false, 'expired' => false]);
check((int)row('SELECT attempts FROM browser_push_queue')['attempts'] === 1, 'temporary delivery failures are retried');
$conn->query('UPDATE browser_push_queue SET available_at = UTC_TIMESTAMP()');
browser_push_process($conn, static fn() => ['success' => false, 'expired' => true]);
check((int)row('SELECT COUNT(*) AS n FROM browser_push_subscriptions')['n'] === 0, 'expired subscriptions are removed');
api(1, $path, ['subscription' => $subscription]);
for ($i = 1; $i <= 9; $i++) {
    api(1, $path, ['subscription' => array_replace($subscription, ['endpoint' => $subscription['endpoint'] . '-' . $i])]);
}
check((int)row('SELECT COUNT(*) AS n FROM browser_push_subscriptions')['n'] === 10, 'up to ten browsers can be enabled');
check(api(1, $path, ['subscription' => array_replace($subscription, ['endpoint' => $subscription['endpoint'] . '-extra'])])['status'] === 409, 'subscription storage is bounded per account');
$keep = hash('sha256', $subscription['endpoint']);
$conn->query("DELETE FROM browser_push_subscriptions WHERE endpoint_hash <> '$keep'");
notification_insert($conn, array_replace($event, ['idempotency_key' => 'already-read-push']));
$conn->query("UPDATE notifications SET is_read = 1 WHERE idempotency_key = 'already-read-push'");
browser_push_process($conn, $sender);
check(count($sent) === 2, 'already-read purchase alerts are not pushed again');
notification_insert($conn, array_replace($event, ['idempotency_key' => 'logout-push']));
api(1, 'auth/logout.php');
browser_push_process($conn, $sender);
check(count($sent) === 2, 'signed-out browsers receive no queued notifications');
check((int)row('SELECT COUNT(*) AS n FROM browser_push_subscriptions')['n'] === 0, 'signed-out subscriptions are cleaned up');
harness_finish();
