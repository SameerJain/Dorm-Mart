<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require __DIR__ . '/auth_handle.php';

init_json_endpoint('POST', ['ok' => false, 'error' => 'Method Not Allowed']);

require_csrf_token(json_request_body()['csrf_token'] ?? null);
logout_destroy_session();

json_response(['ok' => true, 'message' => 'Logged out successfully']);
