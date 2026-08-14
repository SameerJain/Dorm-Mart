<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';

init_json_endpoint('GET', ['success' => false, 'error' => 'Method Not Allowed']);

$userId = require_login();
$currentSessionHash = hash('sha256', session_id());

try {
    $conn = db();
    $stmt = $conn->prepare(
        'SELECT login_id, session_hash, device_type, browser, operating_system,
                ip_address, location, logged_in_at, last_seen_at, signed_out_at
         FROM login_history
         WHERE user_id = ?
         ORDER BY last_seen_at DESC
         LIMIT 50'
    );
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    $devices = [];
    while ($row = $result->fetch_assoc()) {
        $isCurrent = hash_equals((string)$row['session_hash'], $currentSessionHash);
        $devices[] = [
            'id' => (int)$row['login_id'],
            'device_type' => (string)$row['device_type'],
            'browser' => (string)$row['browser'],
            'operating_system' => (string)$row['operating_system'],
            'ip_address' => (string)$row['ip_address'],
            'location' => $row['location'] ?: null,
            'logged_in_at' => (string)$row['logged_in_at'],
            'last_seen_at' => (string)$row['last_seen_at'],
            'signed_out_at' => $row['signed_out_at'] ?: null,
            'is_current' => $isCurrent,
        ];
    }

    $stmt->close();
    $conn->close();

    usort($devices, static function (array $a, array $b): int {
        $currentOrder = (int)$b['is_current'] <=> (int)$a['is_current'];
        return $currentOrder ?: strcmp($b['last_seen_at'], $a['last_seen_at']);
    });
    json_response(['success' => true, 'devices' => $devices]);
} catch (Throwable $e) {
    error_log('login history error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Unable to load logged devices'], 500);
}
