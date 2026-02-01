<?php
require_once __DIR__ . '/email_config.php';
require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

echo json_encode([
    'ok' => true,
    'allowAllEmails' => ALLOW_ALL_EMAILS
]);
