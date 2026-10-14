<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/completion.php';

init_json_endpoint('POST');

try {
    $buyerId = require_login();
    $payload = json_request_body_or_error();
    require_csrf_token($payload['csrf_token'] ?? null);
    $requestId = request_int($payload, 'scheduled_request_id');
    if ($requestId <= 0) json_response(['success' => false, 'error' => 'Scheduled purchase is required'], 400);

    $conn = db();
    $conn->begin_transaction();
    $schedule = payment_schedule($conn, $requestId, true);
    if (!$schedule || (int)$schedule['buyer_user_id'] !== $buyerId) {
        $conn->rollback();
        json_response(['success' => false, 'error' => 'Scheduled purchase not found'], 404);
    }
    if ($schedule['payment_mode'] !== 'mock'
        || payment_modes_for_pair($conn, (int)$schedule['seller_user_id'], $buyerId) !== 'mock') {
        $conn->rollback();
        json_response(['success' => false, 'error' => 'This purchase is not a mock transaction'], 409);
    }
    $stmt = $conn->prepare('SELECT * FROM electronic_payments WHERE scheduled_request_id = ? LIMIT 1 FOR UPDATE');
    $stmt->bind_param('i', $requestId);
    $stmt->execute();
    $payment = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$payment || $payment['payment_mode'] !== 'mock'
        || !in_array($payment['status'], ['requires_payment_method', 'succeeded'], true)) {
        $conn->rollback();
        json_response(['success' => false, 'error' => 'Mock checkout is unavailable'], 409);
    }
    if ($payment['status'] !== 'succeeded') {
        $error = payment_mock_schedule_error($schedule);
        if ($error !== null) {
            $conn->rollback();
            json_response(['success' => false, 'error' => $error], 409);
        }
    }
    $completed = payment_complete_purchase_transaction(
        $conn, (int)$payment['electronic_payment_id'], new DateTimeImmutable('now', new DateTimeZone('UTC'))
    );
    if (empty($completed['completed'])) throw new RuntimeException('Mock purchase could not be completed');
    $conn->commit();
    json_response(['success' => true, 'data' => $completed + ['is_mock' => true]]);
} catch (Throwable $e) {
    if (isset($conn)) { try { $conn->rollback(); } catch (Throwable $ignored) {} }
    error_log('mock payment error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Unable to complete the mock transaction'], 500);
}
