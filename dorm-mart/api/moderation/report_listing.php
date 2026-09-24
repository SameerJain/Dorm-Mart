<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../helpers/listing_reports.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';

init_json_endpoint('POST');
$reporterId = require_login();
$input = json_request_body();
require_csrf_token($input['csrf_token'] ?? null);

$productId = request_int($input, 'product_id');
$reason = is_string($input['reason'] ?? null) ? $input['reason'] : '';
$detailsValue = $input['details'] ?? '';
$details = is_string($detailsValue) ? trim($detailsValue) : '';

if ($productId <= 0 || !array_key_exists($reason, LISTING_REPORT_REASONS)
    || ($detailsValue !== null && !is_string($detailsValue))) {
    json_response(['success' => false, 'error' => 'Invalid report'], 400);
}
if (mb_strlen($details, 'UTF-8') > LISTING_REPORT_DETAILS_MAX) {
    json_response(['success' => false, 'error' => 'Details must be ' . LISTING_REPORT_DETAILS_MAX . ' characters or less'], 400);
}
if ($reason === 'other' && $details === '') {
    json_response(['success' => false, 'error' => 'Please describe the problem'], 400);
}

try {
    $conn = db();
    $conn->set_charset('utf8mb4');

    $stmt = $conn->prepare('SELECT seller_id, title, item_status FROM INVENTORY WHERE product_id = ? LIMIT 1');
    $stmt->bind_param('i', $productId);
    $stmt->execute();
    $item = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    // Only live postings can be reported; drafts are private and sold items are done.
    if (!$item || !in_array($item['item_status'] ?? '', ['Active', 'Pending'], true)) {
        json_response(['success' => false, 'error' => 'Listing not found'], 404);
    }
    $sellerId = (int)$item['seller_id'];
    if ($sellerId === $reporterId) {
        json_response(['success' => false, 'error' => 'You cannot report your own listing'], 409);
    }

    $detailsOrNull = $details !== '' ? $details : null;
    $title = (string)$item['title'];

    // One report per person per listing. Reporting again updates an open
    // report; once a moderator has decided, the decision stands.
    $stmt = $conn->prepare(
        "INSERT INTO listing_reports (product_id, seller_id, reporter_id, listing_title, reason, details)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            report_id = LAST_INSERT_ID(report_id),
            reason = IF(status = 'open', VALUES(reason), reason),
            details = IF(status = 'open', VALUES(details), details)"
    );
    $stmt->bind_param('iiisss', $productId, $sellerId, $reporterId, $title, $reason, $detailsOrNull);
    $stmt->execute();
    $reportId = (int)$conn->insert_id;
    $stmt->close();

    json_response(['success' => true, 'report_id' => $reportId]);
} catch (Throwable $e) {
    error_log('listing report error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Server error'], 500);
}
