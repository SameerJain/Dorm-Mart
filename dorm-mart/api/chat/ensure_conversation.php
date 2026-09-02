<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/inventory.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/helpers.php';

init_json_endpoint('POST');

try {
    $buyerId = require_login();

    $payload = json_request_body_or_error();
    require_csrf_token($payload['csrf_token'] ?? null);

    $productId = request_int($payload, 'product_id');
    $sellerId = request_int($payload, 'seller_user_id');

    if ($productId <= 0 && $sellerId <= 0) {
        json_response(['success' => false, 'error' => 'Missing product_id or seller_user_id'], 400);
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    $productRow = null;

    if ($productId > 0) {
        $stmt = $conn->prepare("SELECT product_id, seller_id, title, photos FROM INVENTORY WHERE product_id = ? AND item_status = 'Active' AND (sold IS NULL OR sold = 0) LIMIT 1");
        if (!$stmt) {
            throw new RuntimeException('Failed to prepare product lookup');
        }
        $stmt->bind_param('i', $productId);
        $stmt->execute();
        $res = $stmt->get_result();
        $productRow = $res ? $res->fetch_assoc() : null;
        $stmt->close();

        if (!$productRow || empty($productRow['seller_id'])) {
            json_response(['success' => false, 'error' => 'Product not found'], 404);
        }

        $fetchedSellerId = (int) $productRow['seller_id'];
        if ($sellerId > 0 && $sellerId !== $fetchedSellerId) {
            json_response(['success' => false, 'error' => 'Seller does not own this product'], 400);
        }
        $sellerId = $fetchedSellerId;
    }

    if ($sellerId <= 0) {
        json_response(['success' => false, 'error' => 'Seller not found'], 400);
    }

    if ($sellerId === $buyerId) {
        json_response(['success' => false, 'error' => 'Cannot message your own listing'], 400);
    }

    $orderedA = min($buyerId, $sellerId);
    $orderedB = max($buyerId, $sellerId);
    $lockKey = sprintf('conv:%d:%d', $orderedA, $orderedB);
    $conversationRow = null;

    try {
        $conn->begin_transaction();

        $stmt = $conn->prepare('SELECT GET_LOCK(?, 5) AS locked');
        $stmt->bind_param('s', $lockKey);
        $stmt->execute();
        $lockRes = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$lockRes || (int) $lockRes['locked'] !== 1) {
            throw new RuntimeException('Could not obtain lock');
        }

        // Fetch existing conversation if present
        // Check for conversation with matching product_id (or NULL if no product)
        if ($productId > 0) {
            $stmt = $conn->prepare('SELECT conv_id, user1_id, user2_id, user1_fname, user2_fname, product_id FROM conversations WHERE user1_id = ? AND user2_id = ? AND product_id = ? LIMIT 1');
            $stmt->bind_param('iii', $orderedA, $orderedB, $productId);
        } else {
            $stmt = $conn->prepare('SELECT conv_id, user1_id, user2_id, user1_fname, user2_fname, product_id FROM conversations WHERE user1_id = ? AND user2_id = ? AND product_id IS NULL LIMIT 1');
            $stmt->bind_param('ii', $orderedA, $orderedB);
        }
        $stmt->execute();
        $result = $stmt->get_result();
        $conversationRow = $result ? $result->fetch_assoc() : null;
        $stmt->close();

        if ($conversationRow) {
            // Ensure conversation participants exist even for existing conversations
            $convId = (int) $conversationRow['conv_id'];
            chat_ensure_participants($conn, $convId, $orderedA, $orderedB);
        }

        if (!$conversationRow) {
            // Need names for both participants
            $names = chat_user_display_names($conn, $orderedA, $orderedB);

            $user1Name = $names[$orderedA] ?? ('User ' . $orderedA);
            $user2Name = $names[$orderedB] ?? ('User ' . $orderedB);

            // Insert conversation with product_id if provided
            if ($productId > 0) {
                $stmt = $conn->prepare('INSERT INTO conversations (user1_id, user2_id, user1_fname, user2_fname, product_id) VALUES (?, ?, ?, ?, ?)');
                $stmt->bind_param('iissi', $orderedA, $orderedB, $user1Name, $user2Name, $productId);
            } else {
                $stmt = $conn->prepare('INSERT INTO conversations (user1_id, user2_id, user1_fname, user2_fname, product_id) VALUES (?, ?, ?, ?, NULL)');
                $stmt->bind_param('iiss', $orderedA, $orderedB, $user1Name, $user2Name);
            }
            $stmt->execute();
            $stmt->close();

            $convId = $conn->insert_id;
            $conversationRow = [
                'conv_id' => $convId,
                'user1_id' => $orderedA,
                'user2_id' => $orderedB,
                'user1_fname' => $user1Name,
                'user2_fname' => $user2Name,
                'product_id' => $productId > 0 ? $productId : null,
            ];

            chat_ensure_participants($conn, $convId, $orderedA, $orderedB);
        }

        chat_release_lock($conn, $lockKey);

        $conn->commit();
    } catch (Throwable $inner) {
        $conn->rollback();
        if (isset($lockKey)) chat_release_lock($conn, $lockKey);
        throw $inner;
    }

    if (!$conversationRow) {
        throw new RuntimeException('Unable to ensure conversation');
    }

    // Add product details to conversation row for consistency with fetch_conversations.php
    if ($productRow) {
        $conversationRow['product_title'] = (string) ($productRow['title'] ?? '');
        $conversationRow['product_seller_id'] = isset($productRow['seller_id']) ? (int) $productRow['seller_id'] : null;

        // Extract first image URL for product_image_url
        $conversationRow['product_image_url'] = inventory_first_photo($productRow['photos'] ?? null);
    } else {
        $conversationRow['product_title'] = null;
        $conversationRow['product_seller_id'] = null;
        $conversationRow['product_image_url'] = null;
    }

    $productDetails = null;
    $buyerName = null;
    $buyerFirst = null;
    $buyerLast = null;
    $sellerName = null;
    $sellerFirst = null;
    $sellerLast = null;
    if ($productRow) {
        $firstImage = inventory_first_photo($productRow['photos'] ?? null);

        if ($firstImage) {
            $publicBase = (getenv('PUBLIC_URL') ?: '');
            $publicBase = rtrim($publicBase, '/');
            if ($firstImage && is_string($firstImage) && strpos($firstImage, 'http') !== 0) {
                if ($firstImage !== '' && $firstImage[0] !== '/') {
                    $firstImage = '/' . $firstImage;
                }
                $firstImage = $publicBase . $firstImage;
            }
        }
        $productDetails = [
            'product_id' => (int) $productRow['product_id'],
            'title' => (string) ($productRow['title'] ?? ''),
            'image_url' => $firstImage,
        ];
    }

    $sharedContactEmail = null;
    $sharedContactPhone = null;
    $namesStmt = $conn->prepare('SELECT user_id, first_name, last_name, email, phone_number, reveal_contact_info FROM user_accounts WHERE user_id IN (?, ?) LIMIT 2');
    if ($namesStmt) {
        $namesStmt->bind_param('ii', $buyerId, $sellerId);
        $namesStmt->execute();
        $namesRes = $namesStmt->get_result();
        while ($row = $namesRes->fetch_assoc()) {
            $id = (int) $row['user_id'];
            $first = trim((string) ($row['first_name'] ?? ''));
            $last = trim((string) ($row['last_name'] ?? ''));
            $full = trim($first . ' ' . $last);
            if ($id === $buyerId) {
                $buyerFirst = $first;
                $buyerLast = $last;
                $buyerName = $full !== '' ? $full : null;
            }
            if ($id === $sellerId) {
                $sellerFirst = $first;
                $sellerLast = $last;
                $sellerName = $full !== '' ? $full : null;
                if ((int)($row['reveal_contact_info'] ?? 0) === 1) {
                    $sharedContactEmail = (string)($row['email'] ?? '');
                    $sharedContactPhone = $row['phone_number'] ?: null;
                }
            }
        }
        $namesStmt->close();
    }
    $conversationRow['shared_contact_email'] = $sharedContactEmail;
    $conversationRow['shared_contact_phone'] = $sharedContactPhone;

    $convId = (int) $conversationRow['conv_id'];
    $existingMessageCount = 0;
    $countStmt = $conn->prepare('SELECT COUNT(*) AS cnt FROM messages WHERE conv_id = ? LIMIT 1');
    if ($countStmt) {
        $countStmt->bind_param('i', $convId);
        $countStmt->execute();
        $cntRes = $countStmt->get_result();
        $cntRow = $cntRes ? $cntRes->fetch_assoc() : null;
        $countStmt->close();
        if ($cntRow) {
            $existingMessageCount = (int) $cntRow['cnt'];
        }
    }

    $autoMessage = null;
    if ($existingMessageCount === 0 && $productDetails && $buyerName) {
        $previewContent = sprintf(
            '%s would like to message you about %s',
            $buyerName,
            $productDetails['title']
        );

        $autoMsgStmt = $conn->prepare(
            'INSERT INTO messages (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        if ($autoMsgStmt) {
            $metadata = json_encode([
                'type' => 'listing_intro',
                'product' => $productDetails,
                'buyer_name' => $buyerName,
            ], JSON_UNESCAPED_SLASHES);

            $senderName = $buyerName;
            if (!$senderName || trim($senderName) === '') {
                $senderName = 'User ' . $buyerId;
            }
            $receiverName = $sellerName ?? ('User ' . $sellerId);

            $autoMsgStmt->bind_param(
                'iiissss',
                $convId,
                $buyerId,
                $sellerId,
                $senderName,
                $receiverName,
                $previewContent,
                $metadata
            );
            $autoMsgStmt->execute();
            $autoMsgId = $autoMsgStmt->insert_id;
            $autoMsgStmt->close();

            $createdIso = gmdate('Y-m-d\TH:i:s\Z');
            $autoMessage = [
                'message_id' => (int) $autoMsgId,
                'conv_id' => $convId,
                'sender_id' => $buyerId,
                'receiver_id' => $sellerId,
                'content' => $previewContent,
                'metadata' => $metadata,
                'created_at' => $createdIso,
            ];

            chat_increment_unread($conn, (int)$autoMsgId, $convId, $sellerId);
        }
    }
    json_response([
        'success' => true,
        'conversation' => $conversationRow,
        'buyer_user_id' => $buyerId,
        'seller_user_id' => $sellerId,
        'conv_id' => $convId,
        'product' => $productDetails,
        'buyer_name' => $buyerName ?? '',
        'seller_name' => $sellerName ?? '',
        'buyer_first_name' => $buyerFirst ?? '',
        'buyer_last_name' => $buyerLast ?? '',
        'seller_first_name' => $sellerFirst ?? '',
        'seller_last_name' => $sellerLast ?? '',
        'auto_message' => $autoMessage,
    ]);
} catch (Throwable $e) {
    error_log('ensure_conversation error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
