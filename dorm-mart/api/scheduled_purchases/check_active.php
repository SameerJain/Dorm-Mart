<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';

init_json_endpoint('POST');

try {
    $userId = require_login();

    $payload = json_request_body_or_error();

    require_csrf_token($payload['csrf_token'] ?? null);

    $productId = request_int($payload, 'product_id');

    if ($productId <= 0) {
        json_response(['success' => false, 'error' => 'Invalid product_id'], 400);
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $checkStmt = $conn->prepare('
        SELECT COUNT(*) as cnt
        FROM scheduled_purchase_requests spr
        WHERE spr.inventory_product_id = ?
          AND (
            spr.status = \'pending\'
            OR (
              spr.status = \'accepted\'
              AND COALESCE((
                SELECT CASE
                  WHEN cpr.status IN (\'buyer_accepted\', \'auto_accepted\') AND cpr.is_successful = 0 THEN 0
                  ELSE 1
                END
                FROM confirm_purchase_requests cpr
                WHERE cpr.scheduled_request_id = spr.request_id
                ORDER BY cpr.confirm_request_id DESC
                LIMIT 1
              ), 1) = 1
            )
          )
    ');
    if (!$checkStmt) {
        throw new RuntimeException('Failed to prepare check query');
    }
    $checkStmt->bind_param('i', $productId);
    $checkStmt->execute();
    $checkRes = $checkStmt->get_result();
    $checkRow = $checkRes ? $checkRes->fetch_assoc() : null;
    $checkStmt->close();

    $hasActive = $checkRow && (int)$checkRow['cnt'] > 0;

    json_response([
        'success' => true,
        'has_active' => $hasActive
    ]);
} catch (Throwable $e) {
    error_log('scheduled-purchase check_active error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
