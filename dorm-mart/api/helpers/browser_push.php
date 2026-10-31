<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/app_config.php';

function browser_push_configured(): bool
{
    return dm_env_string('PUSH_VAPID_PUBLIC_KEY') !== ''
        && dm_env_string('PUSH_VAPID_PRIVATE_KEY') !== ''
        && preg_match('#^(mailto:[^\s@]+@[^\s@]+|https://[^\s]+)$#D', dm_env_string('PUSH_VAPID_SUBJECT')) === 1;
}

/** Only browser push providers, never caller-selected servers or redirect targets. */
function browser_push_valid_endpoint(string $endpoint): bool
{
    if (strlen($endpoint) > 2048 || !filter_var($endpoint, FILTER_VALIDATE_URL)) return false;
    $url = parse_url($endpoint);
    if (($url['scheme'] ?? '') !== 'https' || isset($url['user']) || isset($url['pass']) || isset($url['fragment']) || ($url['port'] ?? 443) !== 443) return false;
    $host = strtolower($url['host'] ?? '');
    return in_array($host, ['fcm.googleapis.com', 'web.push.apple.com'], true)
        || str_ends_with($host, '.push.services.mozilla.com')
        || str_ends_with($host, '.notify.windows.com');
}

function browser_push_decode_key($value, int $length): bool
{
    if (!is_string($value) || !preg_match('/^[A-Za-z0-9_-]+$/D', $value)) return false;
    $decoded = base64_decode(strtr($value, '-_', '+/'), true);
    return $decoded !== false && strlen($decoded) === $length
        && ($length !== 65 || $decoded[0] === "\x04");
}

function browser_push_enqueue(mysqli $conn, int $recipient, string $kind, string $path, ?int $messageId, ?int $notificationId, ?string $available = null): void
{
    if (!browser_push_configured()) return;
    if (!preg_match('#^/app(?:[/?]|$)#D', $path)) $path = '/app/notification';
    $payload = json_encode([
        'title' => $kind === 'message' ? 'New message' : 'Purchase update',
        'body' => $kind === 'message' ? 'You have a new message on Dorm Mart.' : 'Your purchase has an update on Dorm Mart.',
        'path' => $path,
        'tag' => 'dorm-mart-' . substr(hash('sha256', $path), 0, 24),
    ], JSON_THROW_ON_ERROR);
    $available ??= gmdate('Y-m-d H:i:s');
    try {
        $stmt = $conn->prepare(
            'INSERT IGNORE INTO browser_push_queue (subscription_id, message_id, notification_id, payload, available_at)
             SELECT s.subscription_id, ?, ?, ?, ? FROM browser_push_subscriptions s
             JOIN user_accounts u ON u.user_id = s.user_id AND u.auth_version = s.auth_version AND u.is_banned = 0
             JOIN login_history l ON l.login_id = s.login_id AND l.signed_out_at IS NULL
             WHERE s.user_id = ?'
        );
        $stmt->bind_param('iissi', $messageId, $notificationId, $payload, $available, $recipient);
        $stmt->execute();
        $stmt->close();
    } catch (Throwable $e) {
        // Push must never turn a successful message or purchase into an API error.
        error_log('push enqueue failed: ' . $e->getMessage());
    }
}

function browser_push_message(mysqli $conn, int $messageId, int $conversationId, int $recipient): void
{
    if (!browser_push_configured()) return;
    $stmt = $conn->prepare('SELECT metadata FROM messages WHERE message_id = ?');
    $stmt->bind_param('i', $messageId);
    $stmt->execute();
    $metadata = json_decode($stmt->get_result()->fetch_assoc()['metadata'] ?? '{}', true);
    $stmt->close();
    $kind = preg_match('/^(schedule|confirm|payment|purchase|refund)/', (string)($metadata['type'] ?? '')) ? 'purchase' : 'message';
    browser_push_enqueue($conn, $recipient, $kind, '/app/chat?conv=' . $conversationId, $messageId, null);
}

function browser_push_sender(?Psr\Http\Client\ClientInterface $client = null): Closure
{
    require_once dirname(__DIR__, 2) . '/vendor/autoload.php';
    $client ??= new GuzzleHttp\Client(['timeout' => 10, 'connect_timeout' => 5, 'allow_redirects' => false]);
    $webPush = new Minishlink\WebPush\WebPush(['VAPID' => [
        'subject' => dm_env_string('PUSH_VAPID_SUBJECT'),
        'publicKey' => dm_env_string('PUSH_VAPID_PUBLIC_KEY'),
        'privateKey' => dm_env_string('PUSH_VAPID_PRIVATE_KEY'),
    ]], ['TTL' => 300, 'urgency' => 'normal'], $client);
    return static function (array $row, string $payload) use ($webPush): array {
        $subscription = Minishlink\WebPush\Subscription::create([
            'endpoint' => $row['endpoint'], 'publicKey' => $row['public_key'],
            'authToken' => $row['auth_token'], 'contentEncoding' => 'aes128gcm',
        ]);
        $report = $webPush->sendOneNotification($subscription, $payload);
        return ['success' => $report->isSuccess(), 'expired' => $report->isSubscriptionExpired()];
    };
}

/** CLI worker seam: the sender is injectable so integration tests never contact a push service. */
function browser_push_process(mysqli $conn, callable $send): int
{
    $database = (string)$conn->query('SELECT DATABASE()')->fetch_row()[0];
    $lock = 'browser-push-' . substr(hash('sha256', $database), 0, 32);
    $stmt = $conn->prepare('SELECT GET_LOCK(?, 0)');
    $stmt->bind_param('s', $lock);
    $stmt->execute();
    $acquired = (int)$stmt->get_result()->fetch_row()[0] === 1;
    $stmt->close();
    if (!$acquired) return 0;
    $sent = 0;
    try {
        $conn->query('DELETE s FROM browser_push_subscriptions s
            JOIN user_accounts u ON u.user_id = s.user_id
            JOIN login_history l ON l.login_id = s.login_id
            WHERE u.auth_version <> s.auth_version OR u.is_banned = 1 OR l.signed_out_at IS NOT NULL');
        $conn->query('DELETE FROM browser_push_queue WHERE attempts >= 5 OR available_at < UTC_TIMESTAMP() - INTERVAL 1 DAY');
        $rows = $conn->query('SELECT q.*, s.endpoint, s.public_key, s.auth_token
            FROM browser_push_queue q JOIN browser_push_subscriptions s USING (subscription_id)
            WHERE q.available_at <= UTC_TIMESTAMP() ORDER BY q.delivery_id LIMIT 50')->fetch_all(MYSQLI_ASSOC);
        foreach ($rows as $row) {
            // Re-check after network calls: logout/disable may have removed this subscription.
            $id = (int)$row['delivery_id'];
            $active = $conn->query("SELECT q.delivery_id FROM browser_push_queue q
                JOIN browser_push_subscriptions s USING (subscription_id)
                JOIN login_history l ON l.login_id = s.login_id
                JOIN user_accounts u ON u.user_id = s.user_id
                LEFT JOIN messages m ON m.message_id = q.message_id
                LEFT JOIN conversation_participants cp ON cp.conv_id = m.conv_id AND cp.user_id = s.user_id
                LEFT JOIN notifications n ON n.notification_id = q.notification_id
                WHERE q.delivery_id = $id AND l.signed_out_at IS NULL
                  AND u.is_banned = 0 AND u.auth_version = s.auth_version
                  AND (m.message_id IS NULL OR (m.deleted_at IS NULL AND cp.unread_count > 0 AND m.message_id >= cp.first_unread_msg_id))
                  AND (n.notification_id IS NULL OR n.is_read = 0)")->num_rows > 0;
            if (!$active || !browser_push_valid_endpoint($row['endpoint'])) {
                $conn->query("DELETE FROM browser_push_queue WHERE delivery_id = $id");
                continue;
            }
            try { $result = $send($row, $row['payload']); }
            catch (Throwable $e) { $result = ['success' => false, 'expired' => false]; }
            if (!empty($result['expired'])) {
                $subscription = (int)$row['subscription_id'];
                $conn->query("DELETE FROM browser_push_subscriptions WHERE subscription_id = $subscription");
            } elseif (!empty($result['success'])) {
                $conn->query("DELETE FROM browser_push_queue WHERE delivery_id = $id");
                $sent++;
            } else {
                $conn->query("UPDATE browser_push_queue SET attempts = attempts + 1,
                    available_at = UTC_TIMESTAMP() + INTERVAL 1 MINUTE WHERE delivery_id = $id");
            }
        }
    } finally {
        $stmt = $conn->prepare('SELECT RELEASE_LOCK(?)');
        $stmt->bind_param('s', $lock);
        $stmt->execute();
        $stmt->close();
    }
    return $sent;
}
