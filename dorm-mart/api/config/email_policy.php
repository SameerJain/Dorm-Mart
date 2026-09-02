<?php
require_once __DIR__ . '/email_config.php';
require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../helpers/response.php';
set_security_headers();
set_secure_cors();

json_response([
    'ok' => true,
    'allowAllEmails' => ALLOW_ALL_EMAILS
]);
