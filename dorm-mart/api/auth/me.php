<?php
// api/me.php  (or route /api/me to this in your router)
declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();
// Ensure CORS headers are present for React dev server and local PHP server
setSecureCORS();

header('Content-Type: application/json');

// Use require_login() which calls ensure_session() to restore sessions from persistent cookies
require_once __DIR__ . '/auth_handle.php';
$userId = require_login();

echo json_encode([
    'success' => true,
    'user_id' => $userId,
    // add other fields if you want: 'name' => $_SESSION['name'] ?? null
]);