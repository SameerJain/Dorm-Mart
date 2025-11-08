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
            spr.conversation_id,
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

    // Check if buyer is trying to accept - if so, verify item doesn't already have 'Pending' status
    $inventoryProductId = (int)$row['inventory_product_id'];
    if ($action === 'accept' && $inventoryProductId > 0) {
        // Check current item status
        $itemStatusCheckStmt = $conn->prepare('SELECT item_status FROM INVENTORY WHERE product_id = ? LIMIT 1');
        if (!$itemStatusCheckStmt) {
            throw new RuntimeException('Failed to prepare item status check');
        }
        $itemStatusCheckStmt->bind_param('i', $inventoryProductId);
        $itemStatusCheckStmt->execute();
        $itemStatusRes = $itemStatusCheckStmt->get_result();
        $itemStatusRow = $itemStatusRes ? $itemStatusRes->fetch_assoc() : null;
        $itemStatusCheckStmt->close();
        
        // If item already has 'Pending' status, reject this acceptance
        if ($itemStatusRow && isset($itemStatusRow['item_status']) && $itemStatusRow['item_status'] === 'Pending') {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'This item has already been accepted by another buyer']);
            exit;
        }
    }

    $nextStatus = $action === 'accept' ? 'accepted' : 'declined';

    $updateStmt = $conn->prepare('UPDATE scheduled_purchase_requests SET status = ?, buyer_response_at = NOW() WHERE request_id = ? LIMIT 1');
    if (!$updateStmt) {
        throw new RuntimeException('Failed to prepare update');
    }
    $updateStmt->bind_param('si', $nextStatus, $requestId);
    $updateStmt->execute();
    $updateStmt->close();
    
    // Update item status based on scheduled purchase status
    if ($inventoryProductId > 0) {
        if ($nextStatus === 'accepted') {
            // When accepted, set item status to "Pending" (only if not already Sold)
            $itemStatusStmt = $conn->prepare('UPDATE INVENTORY SET item_status = ? WHERE product_id = ? AND item_status != ?');
            if ($itemStatusStmt) {
                $pendingStatus = 'Pending';
                $soldStatus = 'Sold';
                $itemStatusStmt->bind_param('sis', $pendingStatus, $inventoryProductId, $soldStatus);
                $itemStatusStmt->execute();
                $itemStatusStmt->close();
            }
        } elseif ($nextStatus === 'declined') {
            // When denied, set item status back to "Active" (only if currently Pending from this scheduled purchase)
            // Check if there are other accepted scheduled purchases for this item
            $checkOtherAcceptedStmt = $conn->prepare('SELECT COUNT(*) as cnt FROM scheduled_purchase_requests WHERE inventory_product_id = ? AND status = ? AND request_id != ?');
            $acceptedStatus = 'accepted';
            $checkOtherAcceptedStmt->bind_param('isi', $inventoryProductId, $acceptedStatus, $requestId);
            $checkOtherAcceptedStmt->execute();
            $checkRes = $checkOtherAcceptedStmt->get_result();
            $checkRow = $checkRes ? $checkRes->fetch_assoc() : null;
            $checkOtherAcceptedStmt->close();
            
            $hasOtherAccepted = $checkRow && (int)$checkRow['cnt'] > 0;
            
            // Only set back to Active if no other accepted scheduled purchases exist
            if (!$hasOtherAccepted) {
                $itemStatusStmt = $conn->prepare('UPDATE INVENTORY SET item_status = ? WHERE product_id = ? AND item_status = ?');
                if ($itemStatusStmt) {
                    $activeStatus = 'Active';
                    $pendingStatus = 'Pending';
                    $itemStatusStmt->bind_param('sis', $activeStatus, $inventoryProductId, $pendingStatus);
                    $itemStatusStmt->execute();
                    $itemStatusStmt->close();
                }
            }
        }
    }
    
    // Create special message in chat
    $conversationId = isset($row['conversation_id']) ? (int)$row['conversation_id'] : 0;
    if ($conversationId > 0) {
        // Get buyer name
        $buyerStmt = $conn->prepare('SELECT first_name, last_name FROM user_accounts WHERE user_id = ? LIMIT 1');
        $buyerStmt->bind_param('i', $buyerId);
        $buyerStmt->execute();
        $buyerRes = $buyerStmt->get_result();
        $buyerRow = $buyerRes ? $buyerRes->fetch_assoc() : null;
        $buyerStmt->close();
        
        $buyerFirstName = $buyerRow ? trim((string)$buyerRow['first_name']) : '';
        $buyerLastName = $buyerRow ? trim((string)$buyerRow['last_name']) : '';
        $buyerDisplayName = '';
        if ($buyerFirstName !== '' && $buyerLastName !== '') {
            $buyerDisplayName = $buyerFirstName . ' ' . $buyerLastName;
        } else {
            $buyerDisplayName = 'User ' . $buyerId;
        }
        
        $actionText = $action === 'accept' ? 'accepted' : 'denied';
        $messageContent = $buyerDisplayName . ' has ' . $actionText . ' the scheduled purchase.';
        
        // Get conversation details
        $convStmt = $conn->prepare('SELECT user1_id, user2_id FROM conversations WHERE conv_id = ? LIMIT 1');
        $convStmt->bind_param('i', $conversationId);
        $convStmt->execute();
        $convRes = $convStmt->get_result();
        $convRow = $convRes ? $convRes->fetch_assoc() : null;
        $convStmt->close();
        
        if ($convRow) {
            $msgSenderId = $buyerId;
            $msgReceiverId = ($convRow['user1_id'] == $buyerId) ? (int)$convRow['user2_id'] : (int)$convRow['user1_id'];
            
            // Get names for message
            $nameStmt = $conn->prepare('SELECT user_id, first_name, last_name FROM user_accounts WHERE user_id IN (?, ?)');
            $nameStmt->bind_param('ii', $msgSenderId, $msgReceiverId);
            $nameStmt->execute();
            $nameRes = $nameStmt->get_result();
            $names = [];
            while ($nameRow = $nameRes->fetch_assoc()) {
                $id = (int)$nameRow['user_id'];
                $full = trim((string)$nameRow['first_name'] . ' ' . (string)$nameRow['last_name']);
                $names[$id] = $full !== '' ? $full : ('User ' . $id);
            }
            $nameStmt->close();
            
            $senderName = $names[$msgSenderId] ?? ('User ' . $msgSenderId);
            $receiverName = $names[$msgReceiverId] ?? ('User ' . $msgReceiverId);
            
            $metadata = json_encode([
                'type' => $action === 'accept' ? 'schedule_accepted' : 'schedule_denied',
                'request_id' => $requestId,
            ], JSON_UNESCAPED_SLASHES);
            
            $msgStmt = $conn->prepare('INSERT INTO messages (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $msgStmt->bind_param('iiissss', $conversationId, $msgSenderId, $msgReceiverId, $senderName, $receiverName, $messageContent, $metadata);
            $msgStmt->execute();
            $msgId = $msgStmt->insert_id;
            $msgStmt->close();
            
            // Update unread count
            $updateStmt = $conn->prepare('UPDATE conversation_participants SET unread_count = unread_count + 1, first_unread_msg_id = CASE WHEN first_unread_msg_id IS NULL OR first_unread_msg_id = 0 THEN ? ELSE first_unread_msg_id END WHERE conv_id = ? AND user_id = ?');
            $updateStmt->bind_param('iii', $msgId, $conversationId, $msgReceiverId);
            $updateStmt->execute();
            $updateStmt->close();
        }
    }

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


