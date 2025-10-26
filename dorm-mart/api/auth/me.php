<?php
// api/me.php  (or route /api/me to this in your router)
declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();
// Ensure CORS headers are present for React dev server and local PHP server
setSecureCORS();

header('Content-Type: application/json');
session_start(); // <-- pulls existing PHP session (cookie)

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

echo json_encode([
    'success' => true,
    'user_id' => (int) $_SESSION['user_id'],
    // add other fields if you want: 'name' => $_SESSION['name'] ?? null
]);