<?php
declare(strict_types=1);

// JSON response
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();
setSecureCORS();

// Handle preflight
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
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid id']);
        exit;
    }

    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // ============================================================================
    // Product ID and user ID are bound as parameters using bind_param().
    // The '?' placeholders ensure user input is treated as data, not executable SQL.
    // This prevents SQL injection attacks even if malicious values are provided.
    // ============================================================================
    $stmt = $conn->prepare('DELETE FROM INVENTORY WHERE product_id = ? AND seller_id = ?');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare delete');
    }
    $stmt->bind_param('ii', $id, $userId);  // 'i' = integer type, safely bound as parameters
    $stmt->execute();

    if ($stmt->affected_rows < 1) {
        // Not found or not owned by user
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Not found']);
        exit;
    }

    echo json_encode(['success' => true, 'id' => $id]);
} catch (Throwable $e) {
    error_log('delete_listing error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}


