<?php
declare(strict_types=1);

// Purchase lifecycle over real HTTP endpoints: schedule, confirm, cancel, delete,
// ban, and the review and listing-edit rules that depend on them.
// User 1 sells; 2 and 3 buy; 4 is unrelated (and later a moderator).
require __DIR__ . '/support/integration_harness.php';

function fixture(int $buyer = 2): array {
    global $conn;
    $conn->query("INSERT INTO INVENTORY (title,seller_id,listing_price,price_nego,trades,photos,item_location) VALUES ('Lifecycle desk',1,25,1,1,'[\"/test.jpg\"]','North Campus')");
    $product = (int)$conn->insert_id;
    $response = api($buyer, 'chat/ensure_conversation.php', ['product_id' => $product]);
    if (!ok($response)) throw new RuntimeException('Fixture conversation failed: ' . json_encode($response));
    return [$product, (int)$response['body']['conv_id']];
}
function schedule(int $product, int $conversation): array {
    return api(1, 'scheduled_purchases/create.php', ['inventory_product_id' => $product,
        'conversation_id' => $conversation, 'meeting_at' => gmdate('c', time() + 86400),
        'meet_location' => 'North Campus']);
}
function accepted(int $product, int $conversation): int {
    $result = schedule($product, $conversation);
    if (!ok($result)) throw new RuntimeException('Schedule fixture failed: ' . json_encode($result));
    $id = (int)$result['body']['data']['request_id'];
    $result = api(2, 'scheduled_purchases/respond.php', ['request_id' => $id, 'action' => 'accept']);
    if (!ok($result)) throw new RuntimeException('Acceptance fixture failed: ' . json_encode($result));
    return $id;
}
function confirm(int $product, int $conversation, int $schedule, bool $success = true): array {
    return api(1, 'confirm_purchases/create.php', ['product_id' => $product, 'conversation_id' => $conversation,
        'scheduled_request_id' => $schedule, 'is_successful' => $success, 'final_price' => 25,
        'failure_reason' => $success ? null : 'buyer_no_show']);
}

harness_start('lifecycle', 4);

// Exercise the actual review fixture, including its purchase-history format.
$conn->query("UPDATE user_accounts SET email='testuser@buffalo.edu' WHERE user_id=2");
$conn->query("UPDATE user_accounts SET email='testuserschedulered@buffalo.edu' WHERE user_id=1");
$conn->multi_query(file_get_contents($root . '/data/014_#294_review_test_data.sql'));
do {
    if ($result = $conn->store_result()) $result->free();
    if (!$conn->more_results()) break;
    $conn->next_result();
} while (true);
$notebook = (int)row("SELECT product_id FROM INVENTORY WHERE title='Marble Notebook'")['product_id'];
$review = ['product_id' => $notebook, 'rating' => 4, 'product_rating' => 4, 'review_text' => 'Review fixture test'];
$upload = api_multipart(2, 'reviews/upload_review_video.php',
    ['video' => new CURLFile(__DIR__ . '/fixtures/review-video.webm', 'video/webm', 'review.webm')]);
check(ok($upload) && !empty($upload['body']['video_url']), 'buyer can upload a review video');
$uploadedVideo = $upload['body']['video_url'] ?? null;
harness_on_cleanup(static function () use ($uploadedVideo): void {
    if (!$uploadedVideo) return;
    require_once __DIR__ . '/../helpers/image_upload.php';
    @unlink(data_media_dir('review-images') . '/' . basename($uploadedVideo));
});
$review['video_url'] = '/media/review-images/review_u3_20260930_120000_abcdef123456.webm';
check(api(2, 'reviews/submit_review.php', $review)['status'] === 400, 'buyer cannot attach another user video');
$review['video_url'] = '/media/review-images/review_u2_20260930_120000_abcdef123456.webm';
check(api(2, 'reviews/submit_review.php', $review)['status'] === 400, 'missing review video is rejected');
$review['video_url'] = $uploadedVideo;
check(api(3, 'reviews/submit_review.php', array_replace($review, ['video_url' => null]))['status'] === 403, 'unrelated buyer cannot review the seeded notebook');
check(ok(api(2, 'reviews/submit_review.php', $review)), 'seeded Marble Notebook buyer can submit a review');
check(api(2, 'reviews/get_review.php?product_id=' . $notebook, null)['body']['review']['video_url'] === $uploadedVideo, 'buyer can retrieve review video');
check(api(1, 'reviews/get_product_reviews.php?product_id=' . $notebook, null)['body']['reviews'][0]['video_url'] === $uploadedVideo, 'seller dashboard can retrieve review video');
$range = http_get(harness_guest(), 'media/image.php?url=' . rawurlencode((string)$uploadedVideo), ['Range: bytes=0-15']);
check($range['status'] === 206 && strlen($range['raw']) === 16, 'review video supports byte-range playback');
check(api(2, 'reviews/submit_review.php', $review)['status'] === 409, 'seeded notebook cannot be reviewed twice');
$conn->query("UPDATE user_accounts SET email='lifecycle2@buffalo.edu' WHERE user_id=2");
$conn->query("UPDATE user_accounts SET email='lifecycle1@buffalo.edu' WHERE user_id=1");

[$product, $conversation] = fixture();
$request = accepted($product, $conversation);
$confirmation = confirm($product, $conversation, $request);
check(ok($confirmation), 'seller can confirm an accepted schedule');
$confirmationId = (int)$confirmation['body']['data']['confirm_request_id'];
check(rejected(api(3, 'confirm_purchases/respond.php', ['confirm_request_id' => $confirmationId, 'action' => 'accept'])), 'unrelated buyer cannot accept confirmation');
check(ok(api(2, 'confirm_purchases/respond.php', ['confirm_request_id' => $confirmationId, 'action' => 'accept'])), 'buyer completes purchase');
check(rejected(api(2, 'confirm_purchases/respond.php', ['confirm_request_id' => $confirmationId, 'action' => 'accept'])), 'repeat confirmation is rejected');
check((int)row("SELECT sold FROM INVENTORY WHERE product_id=$product")['sold'] === 1, 'completion marks listing sold');
check(rejected(api(2, 'scheduled_purchases/cancel.php', ['request_id' => $request])), 'completed purchase cannot be cancelled');
check(rejected(api(1, 'seller_dashboard/delete_listing.php', ['id' => $product])), 'sold listing and receipt cannot be deleted');

[$product, $conversation] = fixture();
[$otherProduct, $otherConversation] = fixture();
check(rejected(schedule($product, $otherConversation)), 'schedule cannot target a chat for another product');
$first = schedule($product, $conversation);
check(ok($first), 'first schedule is created');
check(rejected(schedule($product, $conversation)), 'duplicate pending schedule is rejected');

// A direct multipart request must not bypass the listing edit restrictions.
foreach (['Active', 'Draft', 'Pending', 'Sold', 'sold_flag'] as $state) {
    [$editProduct] = fixture();
    $storedStatus = $state === 'sold_flag' ? 'Active' : $state;
    $soldFlag = $state === 'sold_flag' ? 1 : 0;
    $conn->query("UPDATE INVENTORY SET item_status='$storedStatus', sold=$soldFlag WHERE product_id=$editProduct");
    foreach (['Active', 'Draft'] as $targetStatus) {
        $edit = api_multipart(1, 'seller_dashboard/product_listing.php', [
            'mode' => 'update', 'id' => (string)$editProduct,
            'status' => $targetStatus, 'title' => 'Edited lifecycle desk',
            'description' => 'A desk for lifecycle testing', 'price' => '25',
            'categories[0]' => 'Furniture', 'itemLocation' => 'North Campus', 'condition' => 'Good',
            'existingPhotos[0]' => '/test.jpg',
        ]);
        [$httpStatus, $body] = [$edit['status'], $edit['body']];
        $blocked = in_array($state, ['Pending', 'Sold', 'sold_flag'], true);
        check($httpStatus === ($blocked ? 403 : 200), "$state listing edit to $targetStatus returns the expected status ($httpStatus: " . json_encode($body) . ')');
        if ($blocked) {
            check(($body['error'] ?? '') === 'Pending or sold listings cannot be edited.', "$state edit reaches the state guard");
            $unchanged = row("SELECT title, item_status, sold FROM INVENTORY WHERE product_id=$editProduct");
            check($unchanged['title'] === 'Lifecycle desk' && $unchanged['item_status'] === $storedStatus
                && (int)$unchanged['sold'] === $soldFlag, "$state edit leaves the listing unchanged");
        }
    }
}

foreach (['Draft', 'Sold'] as $state) {
    [$product, $conversation] = fixture();
    $conn->query("UPDATE INVENTORY SET item_status='$state' WHERE product_id=$product");
    check(rejected(schedule($product, $conversation)), "$state listing cannot be scheduled");
    [$product, $conversation] = fixture();
    $request = (int)schedule($product, $conversation)['body']['data']['request_id'];
    $conn->query("UPDATE INVENTORY SET item_status='$state' WHERE product_id=$product");
    check(rejected(api(2, 'scheduled_purchases/respond.php', ['request_id' => $request, 'action' => 'accept'])), "old schedule cannot accept a $state listing");
}

[$product, $conversation] = fixture();
$request = accepted($product, $conversation);
$confirmationId = (int)confirm($product, $conversation, $request)['body']['data']['confirm_request_id'];
check(ok(api(2, 'scheduled_purchases/cancel.php', ['request_id' => $request])), 'buyer can cancel before completion');
check(rejected(api(2, 'confirm_purchases/respond.php', ['confirm_request_id' => $confirmationId, 'action' => 'accept'])), 'cancelled schedule cannot be completed through old confirmation');
check((int)row("SELECT sold FROM INVENTORY WHERE product_id=$product")['sold'] === 0, 'cancelled purchase leaves listing unsold');

[$product, $conversation] = fixture();
$request = accepted($product, $conversation);
$confirmationId = (int)confirm($product, $conversation, $request)['body']['data']['confirm_request_id'];
api(2, 'scheduled_purchases/cancel.php', ['request_id' => $request]);
$conn->query("UPDATE confirm_purchase_requests SET expires_at=DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE confirm_request_id=$confirmationId");
require_once __DIR__ . '/../confirm_purchases/helpers.php';
$conn->begin_transaction();
auto_finalize_confirm_request($conn, row("SELECT * FROM confirm_purchase_requests WHERE confirm_request_id=$confirmationId"));
$conn->commit();
check((int)row("SELECT sold FROM INVENTORY WHERE product_id=$product")['sold'] === 0, 'cancelled confirmation cannot auto-complete later');

[$product, $conversation] = fixture();
$request = accepted($product, $conversation);
check(rejected(api(1, 'seller_dashboard/set_item_status.php', ['id' => $product, 'status' => 'Active'])), 'reserved listing cannot be manually reactivated');

[$product, $conversation] = fixture();
$request = accepted($product, $conversation);
$confirmationId = (int)confirm($product, $conversation, $request, false)['body']['data']['confirm_request_id'];
api(2, 'confirm_purchases/respond.php', ['confirm_request_id' => $confirmationId, 'action' => 'accept']);
check(row("SELECT item_status FROM INVENTORY WHERE product_id=$product")['item_status'] === 'Active', 'unsuccessful exchange releases listing');
$secondConversation = (int)api(3, 'chat/ensure_conversation.php', ['product_id' => $product])['body']['conv_id'];
$secondRequest = (int)schedule($product, $secondConversation)['body']['data']['request_id'];
check(ok(api(3, 'scheduled_purchases/respond.php', ['request_id' => $secondRequest, 'action' => 'accept'])), 'another buyer can reserve after unsuccessful exchange');
check(rejected(confirm($product, $conversation, $request)), 'old unsuccessful schedule cannot steal a newer reservation');
$secondConfirmationId = (int)confirm($product, $secondConversation, $secondRequest)['body']['data']['confirm_request_id'];
check($secondConfirmationId > $confirmationId, 'second buyer has a newer confirmation on the same listing');
$firstBuyerReceipt = api(2, 'receipt/view_receipt.php?product_id=' . $product, null);
check(ok($firstBuyerReceipt), 'first buyer can still open their receipt after another buyer confirms');
check(ok(api(3, 'receipt/view_receipt.php?product_id=' . $product, null)), 'second buyer can open their receipt');
check(!ok(api(4, 'receipt/view_receipt.php?product_id=' . $product, null)), 'an unrelated user cannot open a receipt for the listing');

[$product, $conversation] = fixture();
$request = accepted($product, $conversation);
check(ok(api(1, 'seller_dashboard/delete_listing.php', ['id' => $product])), 'seller can delete unsold listing with a schedule');
check((int)row("SELECT item_deleted FROM conversations WHERE conv_id=$conversation")['item_deleted'] === 1, 'listing deletion closes chat');
check(rejected(api(2, 'chat/create_message.php', ['conv_id' => $conversation, 'receiver_id' => 1, 'content' => 'Still here?'])), 'closed chat rejects text messages');
check(rejected(api(2, 'scheduled_purchases/respond.php', ['request_id' => $request, 'action' => 'accept'])), 'deleted listing rejects stale schedule card');
check(rejected(confirm($product, $conversation, $request)), 'deleted listing rejects confirmation');

// Wishlist adds are decided by the unique key; a repeat add is a 400, not a 500.
[$product, $conversation] = fixture();
check(ok(api(2, 'wishlist/add_to_wishlist.php', ['product_id' => $product])), 'buyer can wishlist a listing');
$repeatAdd = api(2, 'wishlist/add_to_wishlist.php', ['product_id' => $product]);
check($repeatAdd['status'] === 400 && ($repeatAdd['body']['error'] ?? '') === 'Product already in wishlist', 'repeat wishlist add is rejected cleanly');
check((int)row("SELECT wishlisted FROM INVENTORY WHERE product_id=$product")['wishlisted'] === 1, 'repeat wishlist add does not double-count');

// Chat media is participant-only and answers errors as JSON.
$introMessage = (int)row("SELECT message_id FROM messages WHERE conv_id=$conversation ORDER BY message_id LIMIT 1")['message_id'];
$outsider = http_get(4, 'chat/serve_chat_image.php?message_id=' . $introMessage);
check(error_is($outsider, 403, 'forbidden'), 'non-participant cannot fetch chat media');
check(str_starts_with($outsider['type'], 'application/json'), 'chat media errors are sent as JSON');
check((http_get(2, 'chat/serve_chat_image.php?message_id=' . $introMessage)['body']['error'] ?? '') === 'no_image', 'participant gets no_image for a text message');

// Last: this deletes buyer 2.
[$product, $conversation] = fixture();
accepted($product, $conversation);
check(ok(api(2, 'auth/delete_account.php', ['confirmation' => 'lifecycle2@buffalo.edu', 'currentPassword' => $password])), 'buyer can delete their account');
check(row("SELECT item_status FROM INVENTORY WHERE product_id=$product")['item_status'] === 'Active', 'buyer account deletion puts their reserved item back on sale');

// Ban: seller 1 is banned by moderator 4 while buyer 3 holds a reservation.
[$product, $conversation] = fixture(3);
$request = (int)schedule($product, $conversation)['body']['data']['request_id'];
check(ok(api(3, 'scheduled_purchases/respond.php', ['request_id' => $request, 'action' => 'accept'])), 'buyer reserves before the seller is banned');
$conn->query("UPDATE user_accounts SET role='moderator' WHERE user_id=4");
check(ok(api(4, 'moderation/ban_user.php', ['user_id' => 1, 'banned' => true, 'reason' => 'Lifecycle test'])), 'moderator can ban the seller');
check(row("SELECT status FROM scheduled_purchase_requests WHERE request_id=$request")['status'] === 'cancelled', "banning cancels the banned user's open schedules");
check(row("SELECT item_status FROM INVENTORY WHERE product_id=$product")['item_status'] === 'Active', 'the reserved item is released when its seller is banned');
$results = api(3, 'search/get_search_items.php', ['q' => 'Lifecycle desk'])['body'] ?? [];
check(!in_array($product, array_map(static fn($r) => (int)($r['id'] ?? 0), is_array($results) ? $results : []), true), "a banned seller's listings are hidden from search");
check(api(3, 'product/view_product.php?product_id=' . $product, null)['status'] === 404, "a banned seller's product page is hidden");
check(rejected(api(3, 'chat/ensure_conversation.php', ['product_id' => $product])), 'nobody can start a chat with a banned seller');
check(rejected(api(3, 'chat/create_message.php', ['conv_id' => $conversation, 'receiver_id' => 1, 'content' => 'Hello?'])), 'nobody can message a banned seller');
check((int)row("SELECT COUNT(*) AS c FROM moderation_actions WHERE action='ban_user' AND target_user_id=1")['c'] === 1, 'the ban is written to the moderation audit log');
check(ok(api(4, 'moderation/ban_user.php', ['user_id' => 1, 'banned' => false, 'reason' => 'Lifecycle test'])), 'moderator can lift the ban');
check(api(3, 'product/view_product.php?product_id=' . $product, null)['status'] === 200, 'listings come back once the ban is lifted');

harness_finish();
