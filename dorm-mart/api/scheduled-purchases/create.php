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
    $sellerId = require_login();

    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody, true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    $inventoryId = isset($payload['inventory_product_id']) ? (int)$payload['inventory_product_id'] : 0;
    $conversationId = isset($payload['conversation_id']) ? (int)$payload['conversation_id'] : 0;
    $meetingAtRaw = isset($payload['meeting_at']) ? trim((string)$payload['meeting_at']) : '';
    $description = isset($payload['description']) ? trim((string)$payload['description']) : '';

    $meetLocationChoice = isset($payload['meet_location_choice'])
        ? trim((string)$payload['meet_location_choice'])
        : null;
    $customMeetLocation = isset($payload['custom_meet_location'])
        ? trim((string)$payload['custom_meet_location'])
        : '';
    $meetLocation = isset($payload['meet_location'])
        ? trim((string)$payload['meet_location'])
        : '';

    $allowedMeetLocationChoices = ['', 'North Campus', 'South Campus', 'Ellicott', 'Other'];

    if ($meetLocationChoice !== null) {
        if (!in_array($meetLocationChoice, $allowedMeetLocationChoices, true)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid meet location choice']);
            exit;
        }

        if ($meetLocationChoice === 'Other') {
            if ($customMeetLocation === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Custom meet location is required']);
                exit;
            }
            $meetLocation = $customMeetLocation;
        } elseif ($meetLocationChoice !== '') {
            $meetLocation = $meetLocationChoice;
        }
    }

    if ($inventoryId <= 0 || $conversationId <= 0 || $meetLocation === '' || $meetingAtRaw === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing required fields']);
        exit;
    }

    if (strlen($meetLocation) > 255) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Meet location is too long']);
        exit;
    }

    $meetingAt = date_create($meetingAtRaw);
    if ($meetingAt === false) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid meeting date/time']);
        exit;
    }
    $meetingAt->setTimezone(new DateTimeZone('UTC'));
    $meetingAtDb = $meetingAt->format('Y-m-d H:i:s');

    $conn = db();
    $conn->set_charset('utf8mb4');

    // Verify inventory belongs to seller
    $itemStmt = $conn->prepare('SELECT product_id, title, seller_id FROM INVENTORY WHERE product_id = ? LIMIT 1');
    if (!$itemStmt) {
        throw new RuntimeException('Failed to prepare inventory query');
    }
    $itemStmt->bind_param('i', $inventoryId);
    $itemStmt->execute();
    $itemRes = $itemStmt->get_result();
    $itemRow = $itemRes ? $itemRes->fetch_assoc() : null;
    $itemStmt->close();

    if (!$itemRow || (int)$itemRow['seller_id'] !== $sellerId) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'You can only schedule for your own listings']);
        exit;
    }

    // Verify conversation belongs to seller and get buyer id
    $convStmt = $conn->prepare('SELECT conv_id, user1_id, user2_id, user1_deleted, user2_deleted FROM conversations WHERE conv_id = ? LIMIT 1');
    if (!$convStmt) {
        throw new RuntimeException('Failed to prepare conversation query');
    }
    $convStmt->bind_param('i', $conversationId);
    $convStmt->execute();
    $convRes = $convStmt->get_result();
    $convRow = $convRes ? $convRes->fetch_assoc() : null;
    $convStmt->close();

    if (!$convRow) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Conversation not found']);
        exit;
    }

    $buyerId = 0;
    if ((int)$convRow['user1_id'] === $sellerId) {
        if ((int)$convRow['user1_deleted'] === 1) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Conversation is no longer available']);
            exit;
        }
        $buyerId = (int)$convRow['user2_id'];
    } elseif ((int)$convRow['user2_id'] === $sellerId) {
        if ((int)$convRow['user2_deleted'] === 1) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Conversation is no longer available']);
            exit;
        }
        $buyerId = (int)$convRow['user1_id'];
    } else {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'You do not have access to this conversation']);
        exit;
    }

    if ($buyerId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Could not determine buyer']);
        exit;
    }

    // Ensure buyer is not the seller
    if ($buyerId === $sellerId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Cannot schedule with yourself']);
        exit;
    }

    // Generate unique 4-character code
    $verificationCode = generateUniqueCode($conn);

    $insertStmt = $conn->prepare('INSERT INTO scheduled_purchase_requests (inventory_product_id, seller_user_id, buyer_user_id, conversation_id, meet_location, meeting_at, verification_code, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    if (!$insertStmt) {
        throw new RuntimeException('Failed to prepare insert');
    }
    $conversationIdParam = $conversationId > 0 ? $conversationId : null;
    $descriptionParam = $description !== '' ? $description : null;
    $insertStmt->bind_param(
        'iiiissss',
        $inventoryId,
        $sellerId,
        $buyerId,
        $conversationIdParam,
        $meetLocation,
        $meetingAtDb,
        $verificationCode,
        $descriptionParam
    );
    $insertStmt->execute();
    $requestId = $insertStmt->insert_id;
    $insertStmt->close();
    
    // Create special message in chat
    if ($conversationId > 0) {
        // Get seller name
        $sellerStmt = $conn->prepare('SELECT first_name, last_name FROM user_accounts WHERE user_id = ? LIMIT 1');
        $sellerStmt->bind_param('i', $sellerId);
        $sellerStmt->execute();
        $sellerRes = $sellerStmt->get_result();
        $sellerRow = $sellerRes ? $sellerRes->fetch_assoc() : null;
        $sellerStmt->close();
        
        $sellerFirstName = $sellerRow ? trim((string)$sellerRow['first_name']) : '';
        $sellerLastName = $sellerRow ? trim((string)$sellerRow['last_name']) : '';
        $sellerDisplayName = '';
        if ($sellerFirstName !== '' && $sellerLastName !== '') {
            $sellerDisplayName = $sellerFirstName . ' ' . $sellerLastName;
        } else {
            $sellerDisplayName = 'User ' . $sellerId;
        }
        
        $messageContent = $sellerDisplayName . ' has scheduled a purchase. Please Accept or Deny.';
        
        // Use conversation details from earlier query to determine sender/receiver
        $msgSenderId = $sellerId;
        $msgReceiverId = $buyerId;
        
        // Get names for message
        $nameStmt = $conn->prepare('SELECT user_id, first_name, last_name FROM user_accounts WHERE user_id IN (?, ?)');
        $nameStmt->bind_param('ii', $msgSenderId, $msgReceiverId);
        $nameStmt->execute();
        $nameRes = $nameStmt->get_result();
        $names = [];
        while ($row = $nameRes->fetch_assoc()) {
            $id = (int)$row['user_id'];
            $full = trim((string)$row['first_name'] . ' ' . (string)$row['last_name']);
            $names[$id] = $full !== '' ? $full : ('User ' . $id);
        }
        $nameStmt->close();
        
        $senderName = $names[$msgSenderId] ?? ('User ' . $msgSenderId);
        $receiverName = $names[$msgReceiverId] ?? ('User ' . $msgReceiverId);
        
        $metadata = json_encode([
            'type' => 'schedule_request',
            'request_id' => $requestId,
            'inventory_product_id' => $inventoryId,
            'product_id' => $inventoryId,
            'product_title' => $itemRow['title'] ?? '',
            'meeting_at' => $meetingAt->format(DateTime::ATOM),
            'meet_location' => $meetLocation,
            'verification_code' => $verificationCode,
            'description' => $description,
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

    $response = [
        'success' => true,
        'data' => [
            'request_id' => $requestId,
            'inventory_product_id' => $inventoryId,
            'conversation_id' => $conversationId,
            'seller_user_id' => $sellerId,
            'buyer_user_id' => $buyerId,
            'meet_location' => $meetLocation,
            'meeting_at' => $meetingAt->format(DateTime::ATOM),
            'verification_code' => $verificationCode,
            'status' => 'pending',
        ],
    ];

    echo json_encode($response);
} catch (Throwable $e) {
    error_log('scheduled-purchase create error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}

function generateUniqueCode(mysqli $conn): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $length = strlen($alphabet) - 1;

    $checkStmt = $conn->prepare('SELECT request_id FROM scheduled_purchase_requests WHERE verification_code = ? LIMIT 1');
    if (!$checkStmt) {
        throw new RuntimeException('Failed to prepare code check');
    }

    try {
        while (true) {
            $code = '';
            for ($i = 0; $i < 4; $i++) {
                $code .= $alphabet[random_int(0, $length)];
            }

            $checkStmt->bind_param('s', $code);
            $checkStmt->execute();
            $res = $checkStmt->get_result();
            if ($res && $res->num_rows === 0) {
                return $code;
            }
        }
    } finally {
        $checkStmt->close();
    }
}


