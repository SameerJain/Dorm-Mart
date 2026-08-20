<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/helpers.php';

init_json_endpoint('POST');

try {
    $userId = require_login();
    $payload = json_request_body_or_error();
    require_csrf_token($payload['csrf_token'] ?? null);

    $conn = db();
    $user = payment_user($conn, $userId);
    if (!$user) json_response(['success' => false, 'error' => 'User not found'], 404);
    $mode = payment_mode_for_protected((int)$user['is_protected'] === 1);

    $conn->begin_transaction();
    $account = payment_account($conn, $userId, $mode, true);
    if ($account) {
        $stmt = $conn->prepare(
            'UPDATE connected_payment_accounts SET disconnected_at = NOW(), charges_enabled = 0, payouts_enabled = 0
              WHERE payment_account_id = ?'
        );
        $accountId = (int)$account['payment_account_id'];
        $stmt->bind_param('i', $accountId);
        $stmt->execute();
        $stmt->close();
    }

    $scheduleStmt = $conn->prepare(
        "SELECT * FROM scheduled_purchase_requests
          WHERE seller_user_id = ?
            AND status = 'accepted'
            AND payment_option = 'stripe'
            AND payment_fallback_at IS NULL
          FOR UPDATE"
    );
    $scheduleStmt->bind_param('i', $userId);
    $scheduleStmt->execute();
    $result = $scheduleStmt->get_result();
    while ($schedule = $result->fetch_assoc()) {
        payment_apply_fallback($conn, $schedule, 'seller_disconnected');
    }
    $scheduleStmt->close();
    $conn->commit();

    json_response(['success' => true]);
} catch (Throwable $e) {
    if (isset($conn)) {
        try { $conn->rollback(); } catch (Throwable $ignored) {}
    }
    error_log('payment disconnect error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Unable to disconnect Stripe'], 500);
}

