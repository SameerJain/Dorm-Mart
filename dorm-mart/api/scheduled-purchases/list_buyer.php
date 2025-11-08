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

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

try {
    $buyerId = require_login();

    $conn = db();
    $conn->set_charset('utf8mb4');

    $sql = <<<SQL
        SELECT
            spr.request_id,
            spr.inventory_product_id,
            spr.seller_user_id,
            spr.buyer_user_id,
            spr.conversation_id,
            spr.meet_location,
            spr.meeting_at,
            spr.verification_code,
            spr.description,
            spr.status,
            spr.buyer_response_at,
            spr.created_at,
            spr.updated_at,
            inv.title AS item_title,
            inv.photos AS item_photos,
            seller.first_name AS seller_first_name,
            seller.last_name AS seller_last_name
        FROM scheduled_purchase_requests spr
        INNER JOIN INVENTORY inv ON inv.product_id = spr.inventory_product_id
        INNER JOIN user_accounts seller ON seller.user_id = spr.seller_user_id
        WHERE spr.buyer_user_id = ?
        ORDER BY spr.created_at DESC
    SQL;

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare query');
    }
    $stmt->bind_param('i', $buyerId);
    $stmt->execute();
    $res = $stmt->get_result();

    $records = [];
    while ($row = $res->fetch_assoc()) {
        $meetingAtIso = null;
        if (!empty($row['meeting_at'])) {
            $dt = date_create($row['meeting_at'], new DateTimeZone('UTC'));
            if ($dt) {
                $meetingAtIso = $dt->format(DateTime::ATOM);
            }
        }

        $responseAtIso = null;
        if (!empty($row['buyer_response_at'])) {
            $dtResp = date_create($row['buyer_response_at'], new DateTimeZone('UTC'));
            if ($dtResp) {
                $responseAtIso = $dtResp->format(DateTime::ATOM);
            }
        }

        $photos = [];
        if (!empty($row['item_photos'])) {
            $decoded = json_decode((string)$row['item_photos'], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $photos = $decoded;
            }
        }

        $records[] = [
            'request_id' => (int)$row['request_id'],
            'inventory_product_id' => (int)$row['inventory_product_id'],
            'seller_user_id' => (int)$row['seller_user_id'],
            'buyer_user_id' => (int)$row['buyer_user_id'],
            'conversation_id' => $row['conversation_id'] !== null ? (int)$row['conversation_id'] : null,
            'meet_location' => (string)$row['meet_location'],
            'meeting_at' => $meetingAtIso,
            'verification_code' => (string)$row['verification_code'],
            'description' => isset($row['description']) ? (string)$row['description'] : null,
            'status' => (string)$row['status'],
            'buyer_response_at' => $responseAtIso,
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
            'item' => [
                'title' => (string)$row['item_title'],
                'photos' => $photos,
            ],
            'seller' => [
                'first_name' => (string)$row['seller_first_name'],
                'last_name' => (string)$row['seller_last_name'],
            ],
        ];
    }

    $stmt->close();

    echo json_encode(['success' => true, 'data' => $records]);
} catch (Throwable $e) {
    error_log('scheduled-purchase list_buyer error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}


