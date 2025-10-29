<?php

/*
used to generate and provide a token for ws connection.
this resolves the problem when ws handshake request doesn't include user's cookie on http
*/
declare(strict_types=1);
header('Content-Type: application/json');

require __DIR__ . '/../utility/load_env.php';
load_env(); // must set getenv/$_ENV
session_start();

// Require auth via normal session
$userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
if ($userId <= 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$secret = getenv('WS_TOKEN_SECRET');            // put this in your .env
if (!$secret) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server misconfigured']);
    exit;
}

// Payload: who + when it expires (e.g., 60s)
$payload = [
    'uid'  => $userId,
    'exp'  => time() + 60,                       // short-lived
    'jti'  => bin2hex(random_bytes(8)),          // random id to prevent reuse
];

$payloadJson = json_encode($payload, JSON_UNESCAPED_SLASHES);
$payloadB64  = b64url($payloadJson);            // URL-safe
$sigB64      = b64url(hash_hmac('sha256', $payloadB64, $secret, true));

$token = $payloadB64 . '.' . $sigB64;
echo json_encode(['success' => true, 'token' => $token]);

// --- helpers ---
function b64url(string $data): string {
    // base64 URL variant: +/ -> -_, strip =
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}




