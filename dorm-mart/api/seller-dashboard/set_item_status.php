<?php
declare(strict_types=1);

/** Must match product_listing.php */
const MAX_ACTIVE_LISTINGS_PER_SELLER = 25;

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

    /* Conditional CSRF validation - only validate if token is provided */
    $token = $input['csrf_token'] ?? null;
    if ($token !== null && !validate_csrf_token($token)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'CSRF token validation failed']);
        exit;
    }

    $id = isset($input['id']) ? (int)$input['id'] : 0;
    $status = isset($input['status']) ? (string)$input['status'] : '';

    $valid = ['Active','Pending','Draft','Sold'];
    if ($id <= 0 || !in_array($status, $valid, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid id or status']);
        exit;
    }

    $checkStmt = $conn->prepare('SELECT sold, item_status FROM INVENTORY WHERE product_id = ? AND seller_id = ? LIMIT 1');
    if (!$checkStmt) {
        throw new RuntimeException('Failed to prepare sold-state check');
    }
    $checkStmt->bind_param('ii', $id, $userId);
    $checkStmt->execute();
    $existing = $checkStmt->get_result()->fetch_assoc();
    $checkStmt->close();
    if (!$existing) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Not found']);
        exit;
    }
    $soldFlag = isset($existing['sold']) ? (int)$existing['sold'] : 0;
    $statusStr = isset($existing['item_status']) ? (string)$existing['item_status'] : '';
    if ($soldFlag === 1 || $statusStr === 'Sold') {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Sold listings cannot be edited.']);
        exit;
    }

    // Enforce cap on active listings per seller when activating
    if ($status === 'Active') {
        $capStmt = $conn->prepare(
            'SELECT COUNT(*) AS cnt FROM INVENTORY WHERE seller_id = ? AND item_status = ? AND product_id != ?'
        );
        $activeLabel = 'Active';
        $capStmt->bind_param('isi', $userId, $activeLabel, $id);
        $capStmt->execute();
        $activeCount = (int)$capStmt->get_result()->fetch_assoc()['cnt'];
        $capStmt->close();

        if ($activeCount >= MAX_ACTIVE_LISTINGS_PER_SELLER) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'error' => 'You have reached the maximum of ' . MAX_ACTIVE_LISTINGS_PER_SELLER . ' active listings. Please deactivate or remove an existing listing before activating this one.'
            ]);
            exit;
        }
    }

    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // ============================================================================
    // Status, product ID, and user ID are bound as parameters using bind_param().
    // The '?' placeholders ensure user input is treated as data, not executable SQL.
    // Status is validated against a whitelist ('Active','Pending','Draft','Sold') before binding.
    // ============================================================================
    $stmt = $conn->prepare(
        'UPDATE INVENTORY SET item_status = ? WHERE product_id = ? AND seller_id = ?'
        . ' AND (sold IS NULL OR sold = 0) AND (item_status IS NULL OR item_status <> \'Sold\')'
    );
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


