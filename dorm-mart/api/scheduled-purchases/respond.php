<?php

declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';

setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

try {
    $buyerId = require_login();

    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody, true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    $requestId = isset($payload['request_id']) ? (int)$payload['request_id'] : 0;
    $action = isset($payload['action']) ? strtolower(trim((string)$payload['action'])) : '';

    if ($requestId <= 0 || ($action !== 'accept' && $action !== 'decline')) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid request']);
        exit;
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    $selectSql = <<<SQL
        SELECT
            spr.request_id,
            spr.status,
            spr.buyer_user_id,
            spr.seller_user_id,
            spr.verification_code,
            spr.inventory_product_id,
            spr.meet_location,
            spr.meeting_at,
            inv.title AS item_title
        FROM scheduled_purchase_requests spr
        INNER JOIN INVENTORY inv ON inv.product_id = spr.inventory_product_id
        WHERE spr.request_id = ?
        LIMIT 1
    SQL;

    $selectStmt = $conn->prepare($selectSql);
    if (!$selectStmt) {
        throw new RuntimeException('Failed to prepare select');
    }
    $selectStmt->bind_param('i', $requestId);
    $selectStmt->execute();
    $res = $selectStmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $selectStmt->close();

    if (!$row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Request not found']);
        exit;
    }

    if ((int)$row['buyer_user_id'] !== $buyerId) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Not authorized to respond to this request']);
        exit;
    }

    if ($row['status'] !== 'pending') {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Request has already been handled']);
        exit;
    }

    $nextStatus = $action === 'accept' ? 'accepted' : 'declined';

    $updateStmt = $conn->prepare('UPDATE scheduled_purchase_requests SET status = ?, buyer_response_at = NOW() WHERE request_id = ? LIMIT 1');
    if (!$updateStmt) {
        throw new RuntimeException('Failed to prepare update');
    }
    $updateStmt->bind_param('si', $nextStatus, $requestId);
    $updateStmt->execute();
    $updateStmt->close();

    $meetingAtIso = null;
    if (!empty($row['meeting_at'])) {
        $dt = date_create($row['meeting_at'], new DateTimeZone('UTC'));
        if ($dt) {
            $meetingAtIso = $dt->format(DateTime::ATOM);
        }
    }

    $responseAtIso = (new DateTime('now', new DateTimeZone('UTC')))->format(DateTime::ATOM);

    $response = [
        'success' => true,
        'data' => [
            'request_id' => $requestId,
            'status' => $nextStatus,
            'verification_code' => (string)$row['verification_code'],
            'seller_user_id' => (int)$row['seller_user_id'],
            'buyer_user_id' => $buyerId,
            'inventory_product_id' => (int)$row['inventory_product_id'],
            'meet_location' => (string)$row['meet_location'],
            'meeting_at' => $meetingAtIso,
            'buyer_response_at' => $responseAtIso,
            'item' => [
                'title' => (string)$row['item_title'],
            ],
        ],
    ];

    echo json_encode($response);
} catch (Throwable $e) {
    error_log('scheduled-purchase respond error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}


