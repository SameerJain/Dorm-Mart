<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/auth_handle.php';

init_json_endpoint('GET', ['ok' => false, 'error' => 'Method Not Allowed']);

$token = generate_csrf_token();

json_response([
    'ok' => true,
    'csrf_token' => $token
]);
