<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require __DIR__ . '/auth_handle.php';

init_json_endpoint('POST', ['ok' => false, 'error' => 'Method Not Allowed']);

logout_destroy_session();

json_response(['ok' => true, 'message' => 'Logged out successfully']);
