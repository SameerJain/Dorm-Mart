<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();
setSecureCORS();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

require __DIR__ . '/../auth/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';

try {
    $userId = require_login();
    $conn = db();
    $conn->set_charset('utf8mb4');

    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);
    if (!is_array($input)) $input = [];

    $id = isset($input['id']) ? (int)$input['id'] : 0;
    $status = isset($input['status']) ? (string)$input['status'] : '';

    $valid = ['Active','Pending','Draft','Sold'];
    if ($id <= 0 || !in_array($status, $valid, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid id or status']);
        exit;
    }

    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // ============================================================================
    // Status, product ID, and user ID are bound as parameters using bind_param().
    // The '?' placeholders ensure user input is treated as data, not executable SQL.
    // Status is validated against a whitelist ('Active','Pending','Draft','Sold') before binding.
    // ============================================================================
    $stmt = $conn->prepare('UPDATE INVENTORY SET item_status = ? WHERE product_id = ? AND seller_id = ?');
    if (!$stmt) throw new RuntimeException('Failed to prepare update');
    $stmt->bind_param('sii', $status, $id, $userId);  // 's'=string, 'i'=integer, all safely bound
    $stmt->execute();

    if ($stmt->affected_rows < 1) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Not found']);
        exit;
    }

    echo json_encode(['success' => true, 'id' => $id, 'status' => $status]);
} catch (Throwable $e) {
    error_log('set_item_status error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}


