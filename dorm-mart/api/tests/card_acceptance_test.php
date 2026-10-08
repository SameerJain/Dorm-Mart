<?php
declare(strict_types=1);

// Acceptance rules from the closed Dorm Mart Scrum Board cards, checked over real
// HTTP. Each block names its card. Where a card was written as a manual UI script,
// the check targets the API rule behind it and tries to break that rule: boundary
// values, other users' resources, forged tokens, and repeated or racing requests.
//
// Users: 1 sells; 2 and 3 buy; 4 is unrelated; 5 is locked out; 6 changes and
// resets its password. Mail is disabled by the harness.
require __DIR__ . '/support/integration_harness.php';

harness_start('cards', 6);

function listing(int $seller, string $title = 'Card desk'): int
{
    global $conn;
    $stmt = $conn->prepare("INSERT INTO INVENTORY (title, seller_id, listing_price, photos, item_location, categories, description)
                            VALUES (?, ?, 25, '[\"/test.jpg\"]', 'North Campus', '[\"Furniture\"]', 'A sturdy desk')");
    $stmt->bind_param('si', $title, $seller);
    $stmt->execute();
    return (int)$conn->insert_id;
}

function conversation(int $buyer, int $product): int
{
    $response = api($buyer, 'chat/ensure_conversation.php', ['product_id' => $product]);
    if (!ok($response)) throw new RuntimeException('Fixture conversation failed: ' . json_encode($response));
    return (int)$response['body']['conv_id'];
}

function login_as(string $email, string $userPassword): array
{
    return api(harness_guest('login-probe'), 'auth/login.php', ['email' => $email, 'password' => $userPassword]);
}

function timed(callable $request): array
{
    $started = microtime(true);
    $response = $request();
    return [$response, microtime(true) - $started];
}

// Upload fixtures are generated, never committed.
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
$tinyPng = tempnam(sys_get_temp_dir(), 'dm-png-');
$bigPng = tempnam(sys_get_temp_dir(), 'dm-png-');
$notImage = tempnam(sys_get_temp_dir(), 'dm-txt-');
file_put_contents($tinyPng, $png);
file_put_contents($bigPng, $png . str_repeat("\0", 2 * 1024 * 1024 + 1));
file_put_contents($notImage, "this is plain text pretending to be a photo\n");
harness_on_cleanup(static function () use ($tinyPng, $bigPng, $notImage): void {
    foreach ([$tinyPng, $bigPng, $notImage] as $file) @unlink($file);
});

// --- #64 Enforce limits on login chances / #26 Block invalid usernames too ----
$victim = harness_email(5);
for ($attempt = 1; $attempt <= 4; $attempt++) {
    $wrong = login_as($victim, 'Wrong-password-' . $attempt);
    check(error_is($wrong, 401, 'Invalid credentials'), "#64 failed login $attempt of 4 is refused as invalid credentials");
}
$locked = login_as($victim, 'Wrong-password-5');
check(error_is($locked, 429, 'Too many failed attempts. Please try again in 3 minutes.'), '#64 the fifth failure locks the account for 3 minutes');
check(preg_match('/^Retry-After: 1[0-9]{2}\r?$/mi', $locked['headers']) === 1, '#64 the lockout says when to retry');
check(login_as($victim, $password)['status'] === 429, '#64 the correct password is still refused during the lockout');
check(login_as(strtoupper($victim), $password)['status'] === 429, '#64 changing the email case does not reach a fresh counter');
check(ok(login_as(harness_email(3), $password)), '#64 one account\'s lockout does not lock out other accounts from the same network');

$ghost = 'nobody-here@buffalo.edu';
for ($attempt = 1; $attempt <= 4; $attempt++) {
    login_as($ghost, 'Guess-' . $attempt);
}
check(login_as($ghost, 'Guess-5')['status'] === 429, '#26 repeated attempts on an unknown email are locked out too');

// --- #92 Login input validation / #71 XSS through the login form -------------
check(error_is(login_as('<script>alert(1)</script>@x.co', 'Anything1!'), 400, 'Invalid email format'), '#71 a script tag in the email is rejected as a malformed email');
check(error_is(login_as(harness_email(3), ''), 400, 'Missing required fields'), '#92 an empty password is refused before any lookup');
check(error_is(login_as(harness_email(3), str_repeat('a', 65)), 400, 'Invalid password format. Please check your password.'), '#92 an over-long password is refused');

// --- #87 Change password backend ----------------------------------------------
$changer = 6;
$newPassword = 'Changed-Pass-2';
check(error_is(api(harness_guest(), 'auth/change_password.php', ['currentPassword' => $password, 'newPassword' => $newPassword]), 401, 'Not authenticated'), '#87 changing a password requires a session');
check(api($changer, 'auth/change_password.php', ['currentPassword' => $password, 'newPassword' => $newPassword, 'csrf_token' => str_repeat('0', 64)])['body']['code'] === 'csrf_invalid', '#87 a forged CSRF token is refused');
check(error_is(api($changer, 'auth/change_password.php', ['currentPassword' => 'Not-the-password-1', 'newPassword' => $newPassword]), 401, 'Invalid current password'), '#87 the current password must match');
check(error_is(api($changer, 'auth/change_password.php', ['currentPassword' => $password, 'newPassword' => 'short']), 400, 'Password does not meet policy'), '#87 a weak new password is refused');
check(ok(api($changer, 'auth/change_password.php', ['currentPassword' => $password, 'newPassword' => $newPassword])), '#87 a valid change succeeds');
check(api($changer, 'auth/me.php', null)['status'] === 401, '#87 the session that changed the password is signed out');
check(login_as(harness_email($changer), $password)['status'] === 401, '#87 the old password stops working');
check(ok(login_as(harness_email($changer), $newPassword)), '#87 the new password works');

// --- #55 Reset password backend / #71 SQL injection in the token --------------
$resetToken = bin2hex(random_bytes(32));
$setResetToken = static function (string $token, string $expiresSql) use ($changer): void {
    global $conn;
    $hash = password_hash($token, PASSWORD_DEFAULT);
    $conn->query("UPDATE user_accounts SET reset_token_hash = '$hash', reset_token_expires = $expiresSql WHERE user_id = $changer");
};
$reset = static fn(string $token, string $pass, int $uid = 6): array =>
    api(harness_guest(), 'auth/reset_password.php', ['token' => $token, 'newPassword' => $pass, 'uid' => $uid]);

check(error_is($reset("'; DROP TABLE user_accounts;--", 'Reset-Pass-3'), 400, 'Token, user ID, and new password are required'), '#71 an SQL payload in the reset token is refused as malformed');
check((int)row('SELECT COUNT(*) AS c FROM user_accounts')['c'] === 6, '#71 the injection attempt leaves user_accounts intact');
$setResetToken($resetToken, 'UTC_TIMESTAMP() - INTERVAL 1 MINUTE');
check(($reset($resetToken, 'Reset-Pass-3')['body']['error'] ?? '') === 'Invalid or expired reset token', '#55 an expired reset token is refused');
$setResetToken($resetToken, 'UTC_TIMESTAMP() + INTERVAL 1 HOUR');
check(($reset(bin2hex(random_bytes(32)), 'Reset-Pass-3')['body']['error'] ?? '') === 'Invalid or expired reset token', '#55 a well-formed but wrong token is refused');
check(($reset($resetToken, 'Reset-Pass-3', 3)['body']['error'] ?? '') === 'Invalid or expired reset token', '#55 a valid token cannot reset a different user');
check(error_is($reset($resetToken, 'weakpass'), 400, 'Password does not meet policy requirements'), '#55 the new password must meet the policy');
check(($reset($resetToken, 'Reset-Pass-3')['body']['success'] ?? false) === true, '#55 a valid token resets the password');
check(($reset($resetToken, 'Other-Pass-4')['body']['error'] ?? '') === 'Invalid or expired reset token', '#55 a reset token works only once');
check(ok(login_as(harness_email($changer), 'Reset-Pass-3')), '#55 the reset password works for login');

// --- #60 Forgot password backend -------------------------------------------------
// The card expected an error for unknown emails. The endpoint now answers every
// address identically (202, same message, same ~2 s floor) so it cannot be used to
// discover which emails have accounts; these checks pin that newer contract.
[$unknown, $unknownSeconds] = timed(static fn() => api(harness_guest(), 'auth/forgot_password.php', ['email' => 'not-registered@buffalo.edu']));
$conn->query("UPDATE user_accounts SET reset_token_hash = 'sentinel', last_reset_request = NOW() WHERE user_id = 4");
[$known, $knownSeconds] = timed(static fn() => api(harness_guest(), 'auth/forgot_password.php', ['email' => harness_email(4)]));
check($unknown['status'] === 202 && $known['status'] === 202 && $unknown['body'] === $known['body'], '#60 known and unknown emails get the same answer');
check($unknownSeconds >= 1.9 && $knownSeconds >= 1.9, '#60 both answers take the same minimum time');
check(row('SELECT reset_token_hash FROM user_accounts WHERE user_id = 4')['reset_token_hash'] === 'sentinel', '#60 a second request within 10 minutes does not issue a new link');

// --- #93 / #100 Create account ----------------------------------------------------
$signup = static fn(array $fields): array => api(harness_guest(), 'auth/create_account.php', $fields + [
    'firstName' => 'Card', 'lastName' => 'Tester', 'email' => 'new-card-user@buffalo.edu',
    'gradMonth' => 5, 'gradYear' => (int)date('Y') + 1, 'promos' => false, 'terms' => true,
]);
check(error_is($signup(['terms' => false]), 400, 'You must agree to the terms'), '#93 the terms must be accepted');
check(error_is($signup(['gradMonth' => 1, 'gradYear' => (int)date('Y') - 1]), 400, 'Graduation date cannot be in the past'), '#93 a graduation date in the past is refused');
check(error_is($signup(['firstName' => '']), 400, 'Invalid input format'), '#93 a first name is required');
$duplicate = $signup(['email' => strtoupper(harness_email(1))]);
check($duplicate['status'] === 202 && (int)row("SELECT COUNT(*) AS c FROM user_accounts WHERE email = '" . harness_email(1) . "'")['c'] === 1,
    '#93 an existing email, in any case, gets the generic answer and no second account');
check(error_is($signup([]), 429, 'Too many account requests. Please try again in a few minutes.'), '#93 account requests from one network are rate limited');

// --- #72 CSRF protection and CORS -------------------------------------------------
$freshToken = api(harness_guest(), 'auth/get_csrf_token.php', null)['body']['csrf_token'] ?? '';
check(preg_match('/^[a-f0-9]{64}$/', $freshToken) === 1, '#72 a CSRF token is issued as 64 hex characters');
$beforeListings = (int)row('SELECT COUNT(*) AS c FROM INVENTORY')['c'];
$forged = api_multipart(1, 'seller_dashboard/product_listing.php', [
    'csrf_token' => 'invalid', 'mode' => 'create', 'title' => 'Desk', 'description' => 'A nice desk', 'price' => '50',
    'categories[0]' => 'Furniture', 'itemLocation' => 'North Campus', 'condition' => 'Good',
]);
check(($forged['body']['code'] ?? '') === 'csrf_invalid' && (int)row('SELECT COUNT(*) AS c FROM INVENTORY')['c'] === $beforeListings,
    '#72 a listing post with a bad CSRF token is refused and creates nothing');
global $tokens;
check((api(1, 'wishlist/add_to_wishlist.php', ['product_id' => 1, 'csrf_token' => $tokens[2]])['body']['code'] ?? '') === 'csrf_invalid',
    '#72 another session\'s CSRF token is refused');
$crossSite = api(2, 'auth/me.php', null, ['Origin: https://evil.example']);
check(error_is($crossSite, 403, 'Origin not allowed'), '#72 an untrusted origin is refused');
check(api(2, 'auth/me.php', null, ['Origin: ' . $base . '.evil.example'])['status'] === 403, '#72 an origin that only starts with ours is refused');
$sameSite = api(2, 'auth/me.php', null, ['Origin: ' . $base]);
check(ok($sameSite) && stripos($sameSite['headers'], 'Access-Control-Allow-Origin: ' . $base) !== false, '#72 our own origin is allowed and echoed back');
check(stripos($sameSite['headers'], 'X-Content-Type-Options: nosniff') !== false
    && stripos($sameSite['headers'], 'Content-Security-Policy:') !== false, '#71 API responses carry the security headers');

// --- #24 Message Seller starts a chat ----------------------------------------------
$desk = listing(1);
$intro = api(2, 'chat/ensure_conversation.php', ['product_id' => $desk]);
$deskChat = (int)($intro['body']['conv_id'] ?? 0);
check(ok($intro) && $deskChat > 0, '#24 a buyer can start a chat about a listing');
$introMeta = json_decode((string)(row("SELECT metadata FROM messages WHERE conv_id = $deskChat ORDER BY message_id LIMIT 1")['metadata'] ?? ''), true);
check(($introMeta['type'] ?? '') === 'listing_intro' && (int)($introMeta['product']['product_id'] ?? 0) === $desk, '#24 the chat opens with an intro card for that listing');
check((int)(api(2, 'chat/ensure_conversation.php', ['product_id' => $desk])['body']['conv_id'] ?? 0) === $deskChat
    && (int)row("SELECT COUNT(*) AS c FROM messages WHERE conv_id = $deskChat")['c'] === 1, '#24 pressing Message Seller again reuses the chat without a second intro');
check(error_is(api(1, 'chat/ensure_conversation.php', ['product_id' => $desk]), 400, 'Cannot message your own listing'), '#24 a seller cannot message their own listing');

// --- #34 Chat messages ---------------------------------------------------------------
$send = static fn(int $sender, int $receiver, string $content, int $conv): array =>
    api($sender, 'chat/create_message.php', ['receiver_id' => $receiver, 'conv_id' => $conv, 'content' => $content]);
check(error_is($send(2, 1, '', $deskChat), 400, 'missing_fields'), '#34 an empty message is refused');
check(error_is($send(2, 1, "   \n\t ", $deskChat), 400, 'missing_fields'), '#34 a whitespace-only message is refused');
check(ok($send(2, 1, str_repeat('a', 500), $deskChat)), '#34 a 500-character message is accepted');
check(error_is($send(2, 1, str_repeat('a', 501), $deskChat), 400, 'content_too_long'), '#34 a 501-character message is refused');
check(ok($send(2, 1, str_repeat('😀', 500), $deskChat)), '#34 the limit counts characters, so 500 emoji are accepted');
check(error_is($send(2, 1, str_repeat('😀', 501), $deskChat), 400, 'content_too_long'), '#34 501 emoji are refused');
check(error_is($send(4, 1, 'Let me in', $deskChat), 403, 'Invalid conversation ID'), '#34 an outsider cannot post into someone else\'s chat');

// --- #33 Chat image upload ------------------------------------------------------------
$sendImage = static fn(string $path, string $type, string $name, string $caption = ''): array =>
    api_multipart(2, 'chat/create_image_message.php', ['receiver_id' => '1', 'conv_id' => (string)$deskChat,
        'content' => $caption, 'image' => new CURLFile($path, $type, $name)]);
$photo = $sendImage($tinyPng, 'image/png', 'photo.png');
check(ok($photo), '#33 a photo can be sent with no caption');
$photoUrl = (string)($photo['body']['message']['image_url'] ?? '');
harness_on_cleanup(static function () use ($photoUrl): void {
    if ($photoUrl === '') return;
    require_once __DIR__ . '/../helpers/image_upload.php';
    @unlink(data_media_dir('chat-images') . '/' . basename($photoUrl));
});
check(error_is($sendImage($bigPng, 'image/png', 'huge.png'), 400, 'image_too_large'), '#33 a photo over 2 MB is refused');
check(error_is($sendImage($notImage, 'image/jpeg', 'photo.jpg'), 400, 'unsupported_image_type'), '#33 a file that only claims to be a JPEG is refused');
$photoMessage = (int)($photo['body']['message']['message_id'] ?? 0);
$download = http_get(1, 'chat/serve_chat_image.php?message_id=' . $photoMessage . '&download=1');
check($download['status'] === 200 && $download['raw'] === $png && stripos($download['headers'], 'Content-Disposition: attachment') !== false,
    '#33 the receiver can download the exact photo');
check(http_get(4, 'chat/serve_chat_image.php?message_id=' . $photoMessage)['status'] === 403, '#33 an outsider cannot download it');

// --- #25 Typing indicator ---------------------------------------------------------------
$typing = static fn(int $viewer): array => api($viewer, 'chat/typing_status.php?conversation_id=' . $deskChat, null);
check(ok(api(2, 'chat/typing_status.php', ['conversation_id' => $deskChat, 'is_typing' => true])), '#25 a participant can report typing');
$seen = $typing(1);
check(($seen['body']['is_typing'] ?? false) === true && ($seen['body']['typing_user_first_name'] ?? '') === 'Harness', '#25 the other participant sees who is typing');
check(($typing(2)['body']['is_typing'] ?? true) === false, '#25 the typist does not see their own indicator');
$conn->query("UPDATE typing_status SET updated_at = NOW() - INTERVAL 9 SECOND WHERE conversation_id = $deskChat");
check(($typing(1)['body']['is_typing'] ?? true) === false, '#25 the indicator expires when typing updates stop');
check(error_is($typing(4), 403, 'Access denied'), '#25 an outsider cannot watch the typing status');

// --- #37 Delete an entire conversation ---------------------------------------------------
$listed = static fn(int $user): bool => in_array($deskChat,
    array_map(static fn($c) => (int)($c['conv_id'] ?? 0), api($user, 'chat/fetch_conversations.php', null)['body']['conversations'] ?? []), true);
$messagesBefore = (int)row("SELECT COUNT(*) AS c FROM messages WHERE conv_id = $deskChat")['c'];
check(error_is(api(4, 'chat/delete_conversation.php', ['conv_id' => $deskChat]), 403, 'Not authorized to hide this conversation'), '#37 an outsider cannot delete the chat');
check(ok(api(2, 'chat/delete_conversation.php', ['conv_id' => $deskChat])), '#37 the buyer can delete the chat');
check(!$listed(2) && $listed(1), '#37 deleting hides the chat for the buyer only');
check(ok($send(1, 2, 'Still interested?', $deskChat)) && $listed(2), '#37 a new message from the other side brings the chat back');
api(2, 'chat/delete_conversation.php', ['conv_id' => $deskChat]);
api(1, 'chat/delete_conversation.php', ['conv_id' => $deskChat]);
// The card expected both deletions to erase the messages. They are kept now: purchase
// records and moderation reports point at them. Pin that neither user sees the chat.
check(!$listed(1) && !$listed(2) && (int)row("SELECT COUNT(*) AS c FROM messages WHERE conv_id = $deskChat")['c'] === $messagesBefore + 1,
    '#37 once both delete, neither sees the chat and the history is kept for records');

// --- #23 / #27 Schedule purchase ------------------------------------------------------------
$lamp = listing(1, 'Card lamp');
$lampChat = conversation(2, $lamp);
$scheduleAt = static fn(string $when): array => api(1, 'scheduled_purchases/create.php', ['inventory_product_id' => $lamp,
    'conversation_id' => $lampChat, 'meeting_at' => $when, 'meet_location' => 'North Campus']);
check(rejected($scheduleAt(gmdate('c', time() - 3600))), '#27 a purchase cannot be scheduled in the past');
check(error_is(api(2, 'scheduled_purchases/respond.php', ['request_id' => 999999, 'action' => 'accept']), 404, 'Request not found'), '#23 responding to a missing request is refused');
$pending = (int)($scheduleAt(gmdate('c', time() + 86400))['body']['data']['request_id'] ?? 0);
check($pending > 0, '#23 a seller can schedule a future meeting');
check(error_is(api(2, 'scheduled_purchases/respond.php', ['request_id' => $pending, 'action' => 'maybe']), 400, 'Invalid request'), '#23 an unknown action is refused');
check(error_is(api(3, 'scheduled_purchases/respond.php', ['request_id' => $pending, 'action' => 'accept']), 403, 'Not authorized to respond to this request'), '#23 another buyer cannot answer the request');
check(ok(api(2, 'scheduled_purchases/respond.php', ['request_id' => $pending, 'action' => 'decline'])), '#27 the buyer can decline');
check(row("SELECT status FROM scheduled_purchase_requests WHERE request_id = $pending")['status'] === 'declined', '#27 the decline is recorded');
check(error_is(api(2, 'scheduled_purchases/respond.php', ['request_id' => $pending, 'action' => 'accept']), 409, 'Request has already been handled'), '#27 a declined request cannot then be accepted');

// --- #27 Accepting holds the listing on the scheduled terms -----------------------------------
$rug = listing(1, 'Card rug');
$conn->query("UPDATE INVENTORY SET price_nego = 1 WHERE product_id = $rug");
$rugChat = conversation(2, $rug);
$offer = (int)(api(1, 'scheduled_purchases/create.php', ['inventory_product_id' => $rug, 'conversation_id' => $rugChat,
    'meeting_at' => gmdate('c', time() + 86400), 'meet_location' => 'North Campus', 'negotiated_price' => '18.50'])['body']['data']['request_id'] ?? 0);
// The seller edits the listing after scheduling; acceptance must honour what was agreed.
$conn->query("UPDATE INVENTORY SET price_nego = 0, item_location = 'Ellicott' WHERE product_id = $rug");
check($offer > 0 && ok(api(2, 'scheduled_purchases/respond.php', ['request_id' => $offer, 'action' => 'accept'])), '#27 the buyer can accept a negotiated offer');
$held = row("SELECT item_status, price_nego, listing_price, item_location FROM INVENTORY WHERE product_id = $rug");
check($held['item_status'] === 'Pending' && (int)$held['price_nego'] === 1
    && (float)$held['listing_price'] === 18.5 && $held['item_location'] === 'North Campus',
    '#27 accepting holds the listing at the scheduled terms and the agreed price');

// --- #28 / #48 Reviews ---------------------------------------------------------------------
$notebook = listing(1, 'Card notebook');
$entry = json_encode([['product_id' => $notebook, 'recorded_at' => gmdate('c'), 'confirm_payload' => ['is_successful' => true]]]);
$conn->query("INSERT INTO purchase_history (user_id, items) VALUES (2, '$entry')");
$review = static fn(int $user, array $fields): array => api($user, 'reviews/submit_review.php', $fields + [
    'product_id' => $notebook, 'rating' => 4, 'product_rating' => 4.5, 'review_text' => 'Solid notebook.',
]);
check(error_is($review(2, ['review_text' => '   ']), 400, 'Review text is required'), '#28 an empty review is refused');
check(error_is($review(2, ['review_text' => str_repeat('b', 1001)]), 400, 'Review text must be 1000 characters or less'), '#48 a 1001-character review is refused');
check(rejected($review(2, ['rating' => 5.5])) && rejected($review(2, ['rating' => 0])) && rejected($review(2, ['product_rating' => 3.3])),
    '#28 ratings outside 0.5 to 5 in half steps are refused');
check(error_is($review(3, []), 403, 'You can only review products you have purchased'), '#28 only the buyer can review');
check(error_is($review(1, []), 403, 'You cannot review your own product'), '#28 a seller cannot review their own listing');
check(ok($review(2, ['review_text' => str_repeat('c', 1000)])), '#48 a 1000-character review is accepted');
check(error_is($review(2, []), 409, 'You have already reviewed this product'), '#28 a second review of the same item is refused');
check(error_is(api(2, 'reviews/get_review.php', null), 400, 'Invalid product_id'), '#48 fetching a review needs a product id');
check(mb_strlen((string)(api(2, 'reviews/get_review.php?product_id=' . $notebook, null)['body']['review']['review_text'] ?? '')) === 1000, '#48 the buyer gets their full review back');
check(count(api(1, 'reviews/get_product_reviews.php?product_id=' . $notebook, null)['body']['reviews'] ?? []) === 1, '#49 the seller sees the review');
check(error_is(api(3, 'reviews/get_product_reviews.php?product_id=' . $notebook, null), 403, 'You are not authorized to view reviews for this product'), '#49 other users cannot read the seller\'s review list');

// --- #20 / #47 / #31 Wishlist -----------------------------------------------------------------
$chair = listing(1, 'Card chair');
check(ok(api(2, 'wishlist/add_to_wishlist.php', ['product_id' => $chair])) && ok(api(3, 'wishlist/add_to_wishlist.php', ['product_id' => $chair])),
    '#20 two buyers can wishlist the same item');
$chairRow = array_values(array_filter(api(1, 'seller_dashboard/manage_seller_listings.php', [])['body']['data'] ?? [], static fn($l) => (int)$l['id'] === $chair))[0] ?? [];
check((int)($chairRow['wishlisted'] ?? -1) === 2, '#20 the seller dashboard counts both wishlists');
check(error_is(api(1, 'wishlist/add_to_wishlist.php', ['product_id' => $chair]), 400, 'Cannot add your own listing to wishlist'), '#47 a seller cannot wishlist their own item');
check(error_is(api(2, 'wishlist/add_to_wishlist.php', ['product_id' => 0]), 400, 'Invalid product_id'), '#47 an invalid product id is refused');
check(api(2, 'wishlist/add_to_wishlist.php', ['product_id' => 999999])['status'] === 404, '#47 a missing product is refused');
for ($toggle = 0; $toggle < 5; $toggle++) {
    api(2, 'wishlist/remove_from_wishlist.php', ['product_id' => $chair]);
    api(2, 'wishlist/add_to_wishlist.php', ['product_id' => $chair]);
}
check((int)row("SELECT wishlisted FROM INVENTORY WHERE product_id = $chair")['wishlisted'] === 2
    && (int)row("SELECT COUNT(*) AS c FROM wishlist WHERE product_id = $chair")['c'] === 2, '#20 rapid toggling keeps the counter equal to the real wishlists');
$sellerNotices = (int)row("SELECT COUNT(*) AS c FROM notifications WHERE recipient_user_id = 1 AND type = 'wishlist_added' AND product_id = $chair")['c'];
check($sellerNotices === 2, '#31 the seller is notified once per buyer, not once per toggle');
check(ok(api(1, 'wishlist/mark_all_items_read.php', [])) && (int)(api(1, 'wishlist/fetch_unread_notifications.php', null)['body']['unread_total'] ?? -1) === 0,
    '#31 marking all notifications read clears the unread count');

// --- #74 Seller dashboard backend --------------------------------------------------------------
check(api(harness_guest(), 'seller_dashboard/manage_seller_listings.php', [])['status'] === 401, '#74 the seller dashboard requires a session');
check(api(4, 'seller_dashboard/manage_seller_listings.php', [])['body'] === ['success' => true, 'data' => []], '#74 a user with no listings gets an empty list');
$buyerView = api(2, 'seller_dashboard/manage_seller_listings.php', [])['body']['data'] ?? null;
check($buyerView === [], '#74 a buyer never sees another seller\'s listings');

// --- #65 Search backend / #71 SQL injection in search ---------------------------------------------
$found = static fn(string $query): array => array_map(static fn($r) => (int)($r['id'] ?? 0),
    (array)(api(2, 'search/get_search_items.php', ['q' => $query])['body'] ?? []));
check(in_array($chair, $found('Card chair'), true), '#65 searching by title finds the listing');
check($found("' OR '1'='1") === [] && $found('%') === [], '#71 injection or wildcard text matches nothing');

// --- Upload quota (added for review videos after the uploads audit) ---------------------------------
// Twenty uploads per ten minutes: prime nineteen, so the twentieth is the last one allowed.
$quotaKey = hash('sha256', 'image_upload_review_video' . "\0" . '2');
$conn->query("INSERT INTO login_rate_limits (session_id, failed_login_attempts, last_failed_attempt) VALUES ('$quotaKey', 19, UTC_TIMESTAMP())");
$uploadVideo = static fn(): array => api_multipart(2, 'reviews/upload_review_video.php',
    ['video' => new CURLFile(__DIR__ . '/fixtures/review-video.webm', 'video/webm', 'review.webm')]);
$twentieth = $uploadVideo();
harness_on_cleanup(static function () use ($twentieth): void {
    $url = (string)($twentieth['body']['video_url'] ?? '');
    if ($url === '') return;
    require_once __DIR__ . '/../helpers/image_upload.php';
    @unlink(data_media_dir('review-images') . '/' . basename($url));
});
check(ok($twentieth), 'upload quota: the twentieth video in the window is accepted');
$twentyFirst = $uploadVideo();
check($twentyFirst['status'] === 429 && preg_match('/^Retry-After: \d+\r?$/mi', $twentyFirst['headers']) === 1, 'upload quota: the twenty-first is refused with a retry time');

harness_finish();
