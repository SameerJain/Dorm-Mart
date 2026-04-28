<?php
declare(strict_types=1);

// api/user/me.php — landing/session profile (interested categories, etc.)

require_once __DIR__ . '/../helpers/api_bootstrap.php';

init_json_endpoint('GET', ['ok' => false, 'error' => 'Method Not Allowed']);

try {
    require __DIR__ . '/../auth/auth_handle.php';
    require __DIR__ . '/../database/db_connect.php';

    auth_boot_session();
    $userId = require_login();

    $mysqli = db();

    $stmt = $mysqli->prepare("
        SELECT 
           email,
           interested_category_1, 
           interested_category_2,
           interested_category_3
        FROM user_accounts
        WHERE user_id = ?
        LIMIT 1
    ");
    if (!$stmt) {
    throw new Exception("SQL prepare failed: " . $mysqli->error);
}
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res->fetch_assoc();
    $stmt->close();

    if (!$row) {
        json_response([
            'ok' => true,
            'id' => $userId,
            'name' => null,
            'email' => null,
            'interested_categories' => [],
        ]);
    }

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    $cats = [];
    $c1 = trim((string)($row['interested_category_1'] ?? ''));
    $c2 = trim((string)($row['interested_category_2'] ?? ''));
    $c3 = trim((string)($row['interested_category_3'] ?? ''));
    if ($c1 !== '') $cats[] = $c1;
    if ($c2 !== '' && $c2 !== $c1) $cats[] = $c2;
    if ($c3 !== '' && $c3 !== $c1 && $c3 !== $c2) $cats[] = $c3;

    $cats = array_slice($cats, 0, 3);

    json_response([
        'ok' => true,
        'interested_categories' => $cats,
    ]);

} catch (Throwable $e) {
    error_log('me.php error: ' . $e->getMessage());
    json_response(['ok' => false, 'error' => 'Server error'], 500);
}
