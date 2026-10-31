<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';

init_json_endpoint();

require_once __DIR__ . '/auth_handle.php';
$userId = require_login();
$account = auth_account($userId);

json_response([
    'success' => true,
    'user_id' => $userId,
    'role' => $account['role'] ?? 'user',
]);
