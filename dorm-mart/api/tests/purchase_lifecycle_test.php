<?php
declare(strict_types=1);

// Real HTTP endpoints against a disposable local database. Never uses application data.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../utility/load_env.php';
load_env();
if (!in_array(getenv('DB_HOST'), ['localhost', '127.0.0.1', '::1'], true)) {
    throw new RuntimeException('Lifecycle tests require a local MySQL server.');
}
$database = 'dm_lifecycle_test_' . bin2hex(random_bytes(6));
putenv('DB_NAME=' . $database);
require_once __DIR__ . '/../database/db_connect.php';
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$conn = db();
$root = dirname(__DIR__, 2);
$server = null;
$cookies = [];
$tokens = [];
$failures = 0;
$checks = 0;
$log = tempnam(sys_get_temp_dir(), 'dm-lifecycle-');

function check(bool $condition, string $message): void {
    global $failures, $checks;
    $checks++;
    if (!$condition) $failures++;
    echo ($condition ? 'PASS ' : 'FAIL ') . $message . PHP_EOL;
}
function api(int $user, string $path, ?array $body = []): array {
    global $base, $cookies, $tokens;
    $ch = curl_init($base . '/api/' . $path);
    $headers = ['Content-Type: application/json'];
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10,
        CURLOPT_COOKIEFILE => $cookies[$user], CURLOPT_COOKIEJAR => $cookies[$user]]);
    if ($body !== null) {
        $body['csrf_token'] = $tokens[$user] ?? '';
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($body)]);
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    $raw = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['status' => $status, 'body' => json_decode((string)$raw, true)];
}
function ok(array $response): bool { return $response['status'] === 200; }
function rejected(array $response): bool { return in_array($response['status'], [400, 403, 404, 409], true); }
function row(string $sql): array {
    global $conn;
    return $conn->query($sql)->fetch_assoc() ?: [];
}
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

try {
    $migration = proc_open([PHP_BINARY, 'api/database/migrate_schema.php'],
        [0 => ['pipe','r'], 1 => ['file',$log,'a'], 2 => ['file',$log,'a']], $pipes, $root);
    if (proc_close($migration) !== 0) throw new RuntimeException('Test schema migration failed; inspect ' . $log);
    $password = bin2hex(random_bytes(16));
    $hash = password_hash($password, PASSWORD_DEFAULT);
    for ($id = 1; $id <= 3; $id++) {
        $email = 'lifecycle' . $id . '@buffalo.edu';
        $stmt = $conn->prepare("INSERT INTO user_accounts (user_id,first_name,last_name,grad_month,grad_year,email,hash_pass) VALUES (?, 'Lifecycle', 'Test', 5, 2027, ?, ?)");
        $stmt->bind_param('iss', $id, $email, $hash);
        $stmt->execute();
        $cookies[$id] = tempnam(sys_get_temp_dir(), 'dm-cookie-');
    }
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
    $address = stream_socket_get_name($socket, false);
    fclose($socket);
    $base = 'http://' . $address;
    $server = proc_open([PHP_BINARY, '-S', $address, 'router.php'],
        [0 => ['pipe','r'], 1 => ['file',$log,'a'], 2 => ['file',$log,'a']], $pipes, $root);
    for ($attempt = 0; $attempt < 50; $attempt++) {
        if (@file_get_contents($base . '/api/auth/get_csrf_token.php') !== false) break;
        usleep(100000);
    }
    for ($id = 1; $id <= 3; $id++) {
        $login = api($id, 'auth/login.php', ['email' => 'lifecycle' . $id . '@buffalo.edu', 'password' => $password]);
        if (!ok($login)) throw new RuntimeException('Fixture login failed: ' . json_encode($login));
        $tokens[$id] = api($id, 'auth/get_csrf_token.php', null)['body']['csrf_token'];
    }

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

    [$product, $conversation] = fixture();
    $request = accepted($product, $conversation);
    check(ok(api(1, 'seller_dashboard/delete_listing.php', ['id' => $product])), 'seller can delete unsold listing with a schedule');
    check((int)row("SELECT item_deleted FROM conversations WHERE conv_id=$conversation")['item_deleted'] === 1, 'listing deletion closes chat');
    check(rejected(api(2, 'chat/create_message.php', ['conv_id' => $conversation, 'receiver_id' => 1, 'content' => 'Still here?'])), 'closed chat rejects text messages');
    check(rejected(api(2, 'scheduled_purchases/respond.php', ['request_id' => $request, 'action' => 'accept'])), 'deleted listing rejects stale schedule card');
    check(rejected(confirm($product, $conversation, $request)), 'deleted listing rejects confirmation');

    echo "$checks checks, $failures failures" . PHP_EOL;
} finally {
    if (is_resource($server)) { proc_terminate($server); proc_close($server); }
    $conn->query("DROP DATABASE `$database`");
    $conn->close();
    foreach ($cookies as $cookie) @unlink($cookie);
    @unlink($log);
}
exit($failures > 0 ? 1 : 0);
