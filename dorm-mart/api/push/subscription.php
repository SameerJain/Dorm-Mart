<?php
declare(strict_types=1);
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../helpers/browser_push.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
init_json_endpoint();
$conn = null;
try {
    $userId = require_login();
    $sessionHash = hash('sha256', session_id());
    $conn = db();
    $stmt = $conn->prepare('SELECT login_id FROM login_history WHERE user_id = ? AND session_hash = ? AND signed_out_at IS NULL');
    $stmt->bind_param('is', $userId, $sessionHash);
    $stmt->execute();
    $loginId = (int)($stmt->get_result()->fetch_assoc()['login_id'] ?? 0);
    $stmt->close();
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
        $stmt = $conn->prepare('SELECT endpoint FROM browser_push_subscriptions WHERE user_id = ? AND login_id = ? AND auth_version = ?');
        $version = (int)$_SESSION['auth_version'];
        $stmt->bind_param('iii', $userId, $loginId, $version);
        $stmt->execute();
        $endpoints = array_column($stmt->get_result()->fetch_all(MYSQLI_ASSOC), 'endpoint');
        $stmt->close();
        json_response(['success' => true, 'data' => ['configured' => browser_push_configured(), 'publicKey' => dm_env_string('PUSH_VAPID_PUBLIC_KEY'), 'endpoints' => $endpoints]]);
    }
    require_request_method('POST');
    $input = json_request_body_or_error();
    require_csrf_token($input['csrf_token'] ?? null);
    $action = $input['action'] ?? 'subscribe';
    $subscription = ($input['subscription'] ?? null) instanceof stdClass ? (array)$input['subscription'] : [];
    $endpoint = $action === 'unsubscribe' ? ($input['endpoint'] ?? '') : (is_array($subscription) ? ($subscription['endpoint'] ?? '') : '');
    if (!is_string($endpoint) || !browser_push_valid_endpoint($endpoint) || !in_array($action, ['subscribe', 'unsubscribe'], true)) {
        json_response(['success' => false, 'error' => 'Invalid push subscription'], 400);
    }
    $hash = hash('sha256', $endpoint);
    if ($action === 'unsubscribe') {
        $stmt = $conn->prepare('DELETE FROM browser_push_subscriptions WHERE endpoint_hash = ? AND user_id = ?');
        $stmt->bind_param('si', $hash, $userId);
        $stmt->execute();
        $stmt->close();
        json_response(['success' => true]);
    }
    if (!browser_push_configured()) json_response(['success' => false, 'error' => 'Browser notifications are not configured yet'], 503);
    $keys = ($subscription['keys'] ?? null) instanceof stdClass ? (array)$subscription['keys'] : [];
    $publicKey = $keys['p256dh'] ?? null;
    $auth = $keys['auth'] ?? null;
    if (!browser_push_decode_key($publicKey, 65) || !browser_push_decode_key($auth, 16)) {
        json_response(['success' => false, 'error' => 'Invalid push encryption keys'], 400);
    }
    if ($loginId <= 0) json_response(['success' => false, 'error' => 'Please sign in again before enabling notifications'], 409);
    $conn->begin_transaction();
    $stmt = $conn->prepare('SELECT user_id FROM user_accounts WHERE user_id = ? FOR UPDATE');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $stmt = $conn->prepare('SELECT COUNT(*) AS total FROM browser_push_subscriptions WHERE user_id = ? AND endpoint_hash <> ?');
    $stmt->bind_param('is', $userId, $hash);
    $stmt->execute();
    $total = (int)$stmt->get_result()->fetch_assoc()['total'];
    $stmt->close();
    if ($total >= 10) {
        $conn->rollback();
        json_response(['success' => false, 'error' => 'Notifications are enabled on 10 browsers. Disable one or sign it out first.'], 409);
    }
    // A browser explicitly enabling for a new login discards the previous login's queued alerts.
    $stmt = $conn->prepare('DELETE FROM browser_push_subscriptions WHERE endpoint_hash = ? AND (user_id <> ? OR login_id <> ?)');
    $stmt->bind_param('sii', $hash, $userId, $loginId);
    $stmt->execute();
    $stmt->close();
    $version = (int)$_SESSION['auth_version'];
    $stmt = $conn->prepare('INSERT INTO browser_push_subscriptions (user_id, login_id, auth_version, endpoint, endpoint_hash, public_key, auth_token)
        VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE auth_version = VALUES(auth_version), public_key = VALUES(public_key), auth_token = VALUES(auth_token)');
    $stmt->bind_param('iiissss', $userId, $loginId, $version, $endpoint, $hash, $publicKey, $auth);
    $stmt->execute();
    $stmt->close();
    $conn->commit();
    json_response(['success' => true]);
} catch (Throwable $e) {
    if ($conn instanceof mysqli) { try { $conn->rollback(); } catch (Throwable $ignored) {} }
    error_log('push subscription update failed');
    json_response(['success' => false, 'error' => 'Unable to update browser notifications'], 500);
}
