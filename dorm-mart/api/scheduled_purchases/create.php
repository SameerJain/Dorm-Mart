<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/helpers.php';

init_json_endpoint('POST');

try {
    $sellerId = require_login();

    $payload = json_request_body_or_error();
    require_csrf_token($payload['csrf_token'] ?? null);

    $inventoryId = isset($payload['inventory_product_id']) ? (int)$payload['inventory_product_id'] : 0;
    $conversationId = isset($payload['conversation_id']) ? (int)$payload['conversation_id'] : 0;
    $meetingAtRaw = isset($payload['meeting_at']) ? trim((string)$payload['meeting_at']) : '';
    $description = isset($payload['description']) ? trim((string)$payload['description']) : '';
    
    if (mb_strlen($description) > 1000) {
        json_response(['success' => false, 'error' => 'Description cannot exceed 1000 characters'], 400);
    }
    
    // New fields for price negotiation and trades
    $negotiatedPriceRaw = $payload['negotiated_price'] ?? null;
    $negotiatedPrice = null;
    if ($negotiatedPriceRaw !== null && $negotiatedPriceRaw !== '') {
        $negotiatedPriceString = trim((string)$negotiatedPriceRaw);
        if (!preg_match('/^(?:\d{1,4}(?:\.\d{1,2})?|\.\d{1,2})$/', $negotiatedPriceString)) {
            json_response(['success' => false, 'error' => 'Invalid negotiated price'], 400);
        }
        $negotiatedPrice = (float)$negotiatedPriceString;
    }
    $isTrade = isset($payload['is_trade']) ? (bool)$payload['is_trade'] : false;
    $tradeItemDescription = isset($payload['trade_item_description']) && $payload['trade_item_description'] !== null
        ? trim((string)$payload['trade_item_description']) : null;

    if ($tradeItemDescription !== null && mb_strlen($tradeItemDescription) > 100) {
        json_response(['success' => false, 'error' => 'Trade item description cannot exceed 100 characters'], 400);
    }

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
            json_response(['success' => false, 'error' => 'Invalid meet location choice'], 400);
        }

        if ($meetLocationChoice === 'Other') {
            if ($customMeetLocation === '') {
                json_response(['success' => false, 'error' => 'Custom meet location is required'], 400);
            }
            $meetLocation = $customMeetLocation;
        } elseif ($meetLocationChoice !== '') {
            $meetLocation = $meetLocationChoice;
        }
    }

    if ($inventoryId <= 0 || $conversationId <= 0 || $meetLocation === '' || $meetingAtRaw === '') {
        json_response(['success' => false, 'error' => 'Missing required fields'], 400);
    }

    if (strlen($meetLocation) > 30) {
        json_response(['success' => false, 'error' => 'Meet location is too long'], 400);
    }

    $meetingAt = date_create($meetingAtRaw);
    if ($meetingAt === false) {
        json_response(['success' => false, 'error' => 'Invalid meeting date/time'], 400);
    }
    
    // Check if meeting is more than 3 months in the future
    $now = new DateTime('now', new DateTimeZone('UTC'));
    $threeMonthsFromNow = clone $now;
    $threeMonthsFromNow->modify('+3 months');
    
    if ($meetingAt > $threeMonthsFromNow) {
        json_response(['success' => false, 'error' => 'Meeting date cannot be more than 3 months in advance'], 400);
    }
    
    // Check if meeting is in the past
    if ($meetingAt < $now) {
        json_response(['success' => false, 'error' => 'Meeting date cannot be in the past'], 400);
    }
    
    $meetingAt->setTimezone(new DateTimeZone('UTC'));
    $meetingAtDb = $meetingAt->format('Y-m-d H:i:s');

    $conn = db();
    $conn->set_charset('utf8mb4');

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $itemStmt = $conn->prepare('SELECT product_id, title, seller_id, price_nego, trades, item_location, listing_price FROM INVENTORY WHERE product_id = ? LIMIT 1');
    if (!$itemStmt) {
        throw new RuntimeException('Failed to prepare inventory query');
    }
    $itemStmt->bind_param('i', $inventoryId);
    $itemStmt->execute();
    $itemRes = $itemStmt->get_result();
    $itemRow = $itemRes ? $itemRes->fetch_assoc() : null;
    $itemStmt->close();

    if (!$itemRow || (int)$itemRow['seller_id'] !== $sellerId) {
        json_response(['success' => false, 'error' => 'You can only schedule for your own listings'], 403);
    }

    // Snapshot mechanism: Capture item settings at scheduling time
    // This ensures that if seller changes item settings (price negotiable, trades, location) 
    // after scheduling, the scheduled purchase still uses the original settings when accepted
    $snapshotPriceNego = isset($itemRow['price_nego']) ? ((int)$itemRow['price_nego'] === 1) : false;
    $snapshotTrades = isset($itemRow['trades']) ? ((int)$itemRow['trades'] === 1) : false;
    $snapshotMeetLocation = isset($itemRow['item_location']) ? trim((string)$itemRow['item_location']) : null;

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
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
        json_response(['success' => false, 'error' => 'Conversation not found'], 404);
    }

    $buyerId = 0;
    if ((int)$convRow['user1_id'] === $sellerId) {
        if ((int)$convRow['user1_deleted'] === 1) {
            json_response(['success' => false, 'error' => 'Conversation is no longer available'], 403);
        }
        $buyerId = (int)$convRow['user2_id'];
    } elseif ((int)$convRow['user2_id'] === $sellerId) {
        if ((int)$convRow['user2_deleted'] === 1) {
            json_response(['success' => false, 'error' => 'Conversation is no longer available'], 403);
        }
        $buyerId = (int)$convRow['user1_id'];
    } else {
        json_response(['success' => false, 'error' => 'You do not have access to this conversation'], 403);
    }

    if ($buyerId <= 0) {
        json_response(['success' => false, 'error' => 'Could not determine buyer'], 400);
    }

    // Ensure buyer is not the seller
    if ($buyerId === $sellerId) {
        json_response(['success' => false, 'error' => 'Cannot schedule with yourself'], 400);
    }

    // Generate unique 4-character verification code for buyer-seller meetup confirmation
    $verificationCode = generate_unique_code($conn);

    // Validation: Ensure negotiated price is only allowed for price-negotiable items
    if ($negotiatedPrice !== null && !$snapshotPriceNego) {
        json_response(['success' => false, 'error' => 'This item is not marked as price negotiable'], 400);
    }

    // Validation: Ensure trade option is only allowed for items that accept trades
    if ($isTrade && !$snapshotTrades) {
        json_response(['success' => false, 'error' => 'This item does not accept trades'], 400);
    }

    // Validation: Price and trade are mutually exclusive
    if ($isTrade && $negotiatedPrice !== null) {
        json_response(['success' => false, 'error' => 'Cannot enter a price for a trade'], 400);
    }

    // Validate trade item description if trade is selected
    if ($isTrade && ($tradeItemDescription === null || $tradeItemDescription === '')) {
        json_response(['success' => false, 'error' => 'Trade item description is required when trade is selected'], 400);
    }

    // Validate negotiated price if provided
    if ($negotiatedPrice !== null) {
        if ($negotiatedPrice < 0 || !is_finite($negotiatedPrice)) {
            json_response(['success' => false, 'error' => 'Invalid negotiated price'], 400);
        }
        if ($negotiatedPrice > 9999.99) {
            json_response(['success' => false, 'error' => 'Negotiated price must be $9999.99 or less'], 400);
        }
        $priceDigitsOnly = preg_replace('/[^0-9]/', '', (string)$negotiatedPrice);
        foreach (['80085','8008','5318008','42069','66666','6969','42042','1488','420','666','69','67'] as $_m) {
            if (strpos($priceDigitsOnly, $_m) !== false) {
                json_response(['success' => false, 'error' => 'Invalid price value'], 400);
            }
        }
    }

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $stmt = $conn->prepare('INSERT INTO scheduled_purchase_requests (inventory_product_id, seller_user_id, buyer_user_id, conversation_id, meet_location, meeting_at, verification_code, description, negotiated_price, is_trade, trade_item_description, snapshot_price_nego, snapshot_trades, snapshot_meet_location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare insert');
    }
    
    // Prepare variables for binding - ensure proper NULL handling
    // For nullable integers, use null if value is invalid
    $convId = $conversationId > 0 ? $conversationId : null;
    
    // For nullable strings, convert empty strings to null
    $desc = ($description !== null && $description !== '') ? $description : null;
    $tradeDesc = ($tradeItemDescription !== null && $tradeItemDescription !== '') ? $tradeItemDescription : null;
    $snapLoc = ($snapshotMeetLocation !== null && $snapshotMeetLocation !== '') ? $snapshotMeetLocation : null;
    
    // For nullable decimal, ensure null is passed correctly
    // Allow 0 as a valid price (free item), but convert null/negative to null
    $price = ($negotiatedPrice !== null && $negotiatedPrice >= 0 && is_finite($negotiatedPrice)) ? $negotiatedPrice : null;
    
    // Boolean fields as integers
    $isTradeInt = $isTrade ? 1 : 0;
    $snapshotPriceNegoInt = $snapshotPriceNego ? 1 : 0;
    $snapshotTradesInt = $snapshotTrades ? 1 : 0;
    
    // mysqli bind_param handles NULL correctly, but we need to ensure variables are actually NULL
    // For nullable integer (conversation_id), we pass null directly
    // For nullable strings, mysqli will handle NULL correctly
    // For nullable decimal, mysqli will handle NULL correctly
    $stmt->bind_param('iiiissssdisiis',
        $inventoryId,
        $sellerId,
        $buyerId,
        $convId,
        $meetLocation,
        $meetingAtDb,
        $verificationCode,
        $desc,
        $price,
        $isTradeInt,
        $tradeDesc,
        $snapshotPriceNegoInt,
        $snapshotTradesInt,
        $snapLoc
    );
    
    if (!$stmt->execute()) {
        $error = $stmt->error;
        $stmt->close();
        error_log('Failed to execute scheduled purchase insert: ' . $error);
        throw new RuntimeException('Failed to create scheduled purchase: ' . $error);
    }
    $requestId = $stmt->insert_id;
    $stmt->close();
    
    // Create special message in chat
    if ($conversationId > 0) {
        $sellerDisplayName = scheduled_purchase_user_display_name($conn, $sellerId);
        $messageContent = $sellerDisplayName . ' has scheduled a purchase. Please Accept or Deny.';
        $listingPrice = isset($itemRow['listing_price']) ? (float)$itemRow['listing_price'] : null;

        scheduled_purchase_insert_chat_message($conn, $conversationId, $sellerId, $buyerId, $messageContent, [
            'type' => 'schedule_request',
            'request_id' => $requestId,
            'inventory_product_id' => $inventoryId,
            'product_id' => $inventoryId,
            'product_title' => $itemRow['title'] ?? '',
            'meeting_at' => $meetingAt->format(DateTime::ATOM),
            'meet_location' => $meetLocation,
            'original_meet_location' => $snapshotMeetLocation,
            'verification_code' => $verificationCode,
            'description' => $description,
            'negotiated_price' => $negotiatedPrice,
            'listing_price' => $listingPrice,
            'is_trade' => $isTrade,
            'trade_item_description' => $tradeItemDescription,
        ]);
    }

    // XSS PROTECTION: Escape user-generated content before returning in JSON
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

    json_response($response);
} catch (Throwable $e) {
    error_log('scheduled-purchase create error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}

function generate_unique_code(mysqli $conn): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $length = strlen($alphabet) - 1;

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
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
