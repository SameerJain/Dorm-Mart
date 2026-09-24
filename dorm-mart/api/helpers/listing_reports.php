<?php
declare(strict_types=1);

require_once __DIR__ . '/notifications.php';

/**
 * Preset reasons a listing can be reported for. Keep in sync with
 * src/utils/listingReportReasons.js.
 */
const LISTING_REPORT_REASONS = [
    'prohibited' => 'Prohibited or illegal item',
    'scam' => 'Scam or fraud',
    'misleading' => 'Misleading description or photos',
    'offensive' => 'Offensive or inappropriate content',
    'spam' => 'Spam or duplicate listing',
    'other' => 'Something else',
];

const LISTING_REPORT_DETAILS_MAX = 500;

function listing_report_reason_label(string $reason): string
{
    return LISTING_REPORT_REASONS[$reason] ?? LISTING_REPORT_REASONS['other'];
}

/**
 * Delete a listing and everything that hangs off it, inside the caller's
 * transaction: wishlist users are told it is gone, and every conversation
 * about it gets a closing message and is marked item_deleted.
 *
 * Returns false when no row matched. The caller commits and then deletes the
 * listing's media, so a rolled-back delete never points at missing files.
 */
function listing_delete(mysqli $conn, int $productId, int $sellerId, array $item, string $chatMessage): bool
{
    notification_for_wishlist($conn, $productId, [
        'type' => 'item_deleted', 'product_id' => null, 'title' => (string)$item['title'],
        'message' => (string)$item['title'] . ' was deleted and is no longer available.',
        'image_url' => notification_first_image($item['photos'] ?? null),
        'severity' => 'warning', 'destination' => null,
        'idempotency_key' => 'deleted-' . $productId,
    ]);

    $convStmt = $conn->prepare('SELECT conv_id, user1_id, user2_id, user1_fname, user2_fname FROM conversations WHERE product_id = ?');
    if (!$convStmt) {
        throw new RuntimeException('Failed to prepare conversation query');
    }
    $convStmt->bind_param('i', $productId);
    $convStmt->execute();
    $conversations = $convStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $convStmt->close();

    $metadata = json_encode(['type' => 'item_deleted'], JSON_UNESCAPED_SLASHES);
    foreach ($conversations as $conv) {
        $convId = (int)$conv['conv_id'];
        $user1Id = (int)$conv['user1_id'];
        $user2Id = (int)$conv['user2_id'];
        $user1Fname = (string)$conv['user1_fname'];
        $user2Fname = (string)$conv['user2_fname'];

        // Sent as user1 to user2 because messages need real participants;
        // both users see it when the conversation loads.
        $msgStmt = $conn->prepare(
            'INSERT INTO messages (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        if ($msgStmt) {
            $msgStmt->bind_param('iiissss', $convId, $user1Id, $user2Id, $user1Fname, $user2Fname, $chatMessage, $metadata);
            $msgStmt->execute();
            $msgStmt->close();
        }

        $updateStmt = $conn->prepare('UPDATE conversations SET item_deleted = TRUE WHERE conv_id = ?');
        if ($updateStmt) {
            $updateStmt->bind_param('i', $convId);
            $updateStmt->execute();
            $updateStmt->close();
        }
    }

    $stmt = $conn->prepare('DELETE FROM INVENTORY WHERE product_id = ? AND seller_id = ?');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare delete');
    }
    $stmt->bind_param('ii', $productId, $sellerId);
    $stmt->execute();
    $deleted = $stmt->affected_rows > 0;
    $stmt->close();

    return $deleted;
}

/**
 * Tell a reporter their listing report was handled. One notification per
 * report; it never says what happened to the seller beyond the listing.
 */
function listing_report_notify_reporter(mysqli $conn, int $reportId, int $reporterId, string $title, bool $removed): void
{
    if ($reporterId <= 0) {
        return;
    }

    notification_insert($conn, [
        'recipient_user_id' => $reporterId,
        'type' => $removed ? 'listing_report_resolved' : 'listing_report_dismissed',
        'title' => 'Your report was reviewed',
        'message' => $removed
            ? "Thanks for reporting \"{$title}\". A moderator reviewed it and removed the listing."
            : "A moderator reviewed \"{$title}\" and found that it does not break our guidelines.",
        'severity' => $removed ? 'success' : 'info',
        'metadata' => ['listing_report_id' => $reportId],
        'idempotency_key' => 'listing-report-outcome-' . $reportId,
    ]);
}
