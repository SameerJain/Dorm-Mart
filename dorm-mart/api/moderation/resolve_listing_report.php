<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../helpers/listing_reports.php';
require_once __DIR__ . '/../helpers/image_upload.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';

init_json_endpoint('POST');
$moderatorId = require_moderator();
$input = json_request_body();
require_csrf_token($input['csrf_token'] ?? null);

$reportId = request_int($input, 'report_id');
$action = is_string($input['action'] ?? null) ? $input['action'] : '';
$removalReason = is_string($input['removal_reason'] ?? null) ? $input['removal_reason'] : '';
$noteValue = $input['note'] ?? '';
$note = is_string($noteValue) ? trim($noteValue) : '';

if ($reportId <= 0 || !in_array($action, ['remove', 'dismiss'], true)
    || ($removalReason !== '' && !array_key_exists($removalReason, LISTING_REPORT_REASONS))
    || ($noteValue !== null && !is_string($noteValue))
    || mb_strlen($note, 'UTF-8') > LISTING_REPORT_DETAILS_MAX) {
    json_response(['success' => false, 'error' => 'Invalid report update'], 400);
}

$conn = null;
$mediaToDelete = [];
$mediaOwner = 0;

try {
    $conn = db();
    $conn->set_charset('utf8mb4');
    $conn->begin_transaction();

    $stmt = $conn->prepare('SELECT * FROM listing_reports WHERE report_id = ? LIMIT 1 FOR UPDATE');
    $stmt->bind_param('i', $reportId);
    $stmt->execute();
    $report = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$report) json_response(['success' => false, 'error' => 'Report not found'], 404);
    if ($report['status'] !== 'open') {
        json_response(['success' => false, 'error' => 'This report has already been handled'], 409);
    }

    $title = (string)$report['listing_title'];

    if ($action === 'dismiss') {
        $stmt = $conn->prepare(
            "UPDATE listing_reports SET status = 'dismissed', resolved_at = NOW(), resolved_by = ?
              WHERE report_id = ? AND status = 'open'"
        );
        $stmt->bind_param('ii', $moderatorId, $reportId);
        $stmt->execute();
        $stmt->close();

        listing_report_notify_reporter($conn, $reportId, (int)($report['reporter_id'] ?? 0), $title, false);
        $conn->commit();
        json_response(['success' => true, 'report_id' => $reportId, 'status' => 'dismissed']);
    }

    // Removing a listing settles every open report about it, not just this one.
    $productId = (int)($report['product_id'] ?? 0);
    $openReports = [['report_id' => $reportId, 'reporter_id' => (int)($report['reporter_id'] ?? 0)]];
    $item = null;

    if ($productId > 0) {
        $stmt = $conn->prepare(
            "SELECT report_id, reporter_id FROM listing_reports
              WHERE product_id = ? AND status = 'open' FOR UPDATE"
        );
        $stmt->bind_param('i', $productId);
        $stmt->execute();
        $openReports = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        $stmt = $conn->prepare('SELECT seller_id, title, photos FROM INVENTORY WHERE product_id = ? LIMIT 1 FOR UPDATE');
        $stmt->bind_param('i', $productId);
        $stmt->execute();
        $item = $stmt->get_result()->fetch_assoc() ?: null;
        $stmt->close();
    }

    // Mark the reports first: deleting the listing nulls their product_id.
    $ids = array_map(static fn($r) => (int)$r['report_id'], $openReports);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $conn->prepare(
        "UPDATE listing_reports SET status = 'removed', resolved_at = NOW(), resolved_by = ?
          WHERE status = 'open' AND report_id IN ($placeholders)"
    );
    $stmt->bind_param('i' . str_repeat('i', count($ids)), $moderatorId, ...$ids);
    $stmt->execute();
    $stmt->close();

    if ($item) {
        $sellerId = (int)$item['seller_id'];
        listing_delete(
            $conn,
            $productId,
            $sellerId,
            $item,
            'This listing was removed by a moderator. This chat has been closed.'
        );

        $reasonLabel = listing_report_reason_label($removalReason !== '' ? $removalReason : (string)$report['reason']);
        $message = "A moderator removed this listing. Reason: {$reasonLabel}.";
        if ($note !== '') {
            $message .= " Note from the moderator: {$note}";
        }
        $support = dm_support_email();
        $message .= $support !== ''
            ? " If you think this was a mistake, contact {$support}."
            : ' If you think this was a mistake, contact Dorm Mart support.';

        // No product_id or image: the listing row and its media are about to be gone.
        notification_insert($conn, [
            'recipient_user_id' => $sellerId,
            'type' => 'listing_removed',
            'title' => (string)$item['title'],
            'message' => $message,
            'severity' => 'urgent',
            'destination' => '/app/seller-dashboard',
            'metadata' => ['reason' => $removalReason !== '' ? $removalReason : $report['reason'], 'listing_report_id' => $reportId],
            'idempotency_key' => 'listing-removed-' . $productId,
        ]);

        $mediaToDelete = listing_media_urls($item['photos'] ?? null);
        $mediaOwner = $sellerId;
    }

    foreach ($openReports as $open) {
        listing_report_notify_reporter($conn, (int)$open['report_id'], (int)($open['reporter_id'] ?? 0), $title, true);
    }

    $conn->commit();

    // Same order as a seller's own delete: files go only after the row is gone for good.
    if ($mediaOwner > 0) {
        delete_owned_listing_media($mediaToDelete, $mediaOwner);
    }

    json_response(['success' => true, 'report_id' => $reportId, 'status' => 'removed', 'resolved_reports' => $ids]);
} catch (Throwable $e) {
    if ($conn instanceof mysqli) { try { $conn->rollback(); } catch (Throwable $_) {} }
    error_log('listing report resolution error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Server error'], 500);
}
