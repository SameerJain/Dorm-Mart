<?php
// api/auth/me.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';

init_json_endpoint();

// Use require_login() which calls ensure_session() to restore sessions from persistent cookies
require_once __DIR__ . '/auth_handle.php';
$userId = require_login();

json_response([
    'success' => true,
    'user_id' => $userId,
    // add other fields if you want: 'name' => $_SESSION['name'] ?? null
]);
