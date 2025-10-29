<?php
// api/ws/ChatServer.php

declare(strict_types=1);

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;

$root = dirname(__DIR__, 2);
require_once $root . '/api/utility/load_env.php';
load_env();

// require_once __DIR__ . '/../security/security.php';
// setSecurityHeaders();
// setSecureCORS();

class ChatServer implements MessageComponentInterface
{
    /** Tracks all connected clients */
    private $clients;
    private $ByUserId = [];

    public function __construct() {
        $this->clients = new \SplObjectStorage();
    }

    public function onOpen(ConnectionInterface $conn): void {
        $env = getenv('ENV');
        // local and prod behaves differently
        if ($env === 'local' || 'dev'){
            $query = $conn->httpRequest->getUri()->getQuery(); // e.g., "token=abc.def"
            parse_str($query, $q);
            $token = $q['token'] ?? '';
            $secret = getenv('WS_TOKEN_SECRET'); // same secret as issuer
            $userId = $this->verifyWsToken($token, $secret);

            if ($userId === null) {
                // 4001: custom policy violation; closes the socket
                $conn->close(4001);
                return;
            }

        } else {
            $sid = $this->extractPhpSessIdFromCookies($conn);     // may return null
            if (!$sid) {
                // 4401 is a common custom code for "unauthorized" (not IANA standard).
                $conn->close(4401);
                return;
            }

            // 2) Resume that HTTP session and read the app identity (e.g., user_id)
            $userId = $this->resumePhpSessionAndGetUserId($sid);  // may return null
            if ($userId === null || $userId <= 0) {
                $conn->close(4401);
                return;
            }
        }

        $conn->userId = (int)$userId;
        $this->clients->attach($conn);
        $this->ByUserId[$conn->userId] = $conn;
        error_log(sprintf('[ws] user %d joined (conn #%d)', $userId, $conn->resourceId));
        $conn->send(json_encode([
            'type' => 'hello',
            'payload' =>[
                "msg" => "Chat server welcomes you!"
            ]
        ]));
    }

    public function onMessage(ConnectionInterface $from, $msg): void {
        // Messages are JSON. Keep it small and explicit.
        $data = json_decode($msg, true);
        if (!is_array($data) || !isset($data['type'])) {
            // Ignore junk
            return;
        }
        $type = $data['type'];

        switch ($type) {
            case 'join_pool':
                $userId = $data['payload']['userId'];
                $this->clients->attach($from, ['userId' => $userId]);
                $this->ByUserId[$userId] = $from;
                error_log(sprintf('[ws] user %d joined (conn #%d)', $userId, $from->resourceId));
                break;
            case 'send_message':
                $convId = $data['payload']['convId'];
                $fromUserId = $data['payload']['fromUserId'];
                $toUserId   = $data['payload']['toUserId'];
                $content = $data['payload']['content'];


                if (!$toUserId || !isset($this->ByUserId[$toUserId])) {
                    // recipient not connected; tell sender and bail
                    $from->send(json_encode([
                        'type' => 'error',
                        'payload' => ['msg' => 'recipient not connected']
                    ]));
                    break;
                }

                $res = json_encode([
                    "type" => "new_message",
                    "payload" => [
                        "convId" => $convId,
                        "fromUserId" => $fromUserId,
                        "content" => $content
                    ]
                ]);

                $toUserConn = $this->ByUserId[$toUserId];
                $toUserConn->send($res);

                $from -> send(json_encode([
                    "type" => "sent_message",
                    "payload" => [
                        "msg" => "sucessfully sent your message"
                    ]
                ]));
                break;
        }
    }


    public function onClose(ConnectionInterface $conn): void
    {
        if ($this->clients->contains($conn)) { // <-- guard
            $meta   = $this->clients[$conn];   // SplObjectStorage metadata
            $userId = is_array($meta) ? ($meta['userId'] ?? null) : null;
            $this->clients->detach($conn);
            if ($userId !== null) {
                unset($this->ByUserId[$userId]);
            }
        }
    }

    public function onError(ConnectionInterface $conn, \Exception $e): void
    {
        $conn->send(json_encode([
            'type' => 'error',
            'payload' => [
                "msg" => "ws connection error"
            ]
        ]));
        $conn->close();
    }

    /** Pull PHPSESSID from the WebSocket Upgrade request */
    private function extractPhpSessIdFromCookies(ConnectionInterface $conn): ?string
    {
        // $conn->httpRequest is a PSR-7 Request (Guzzle PSR-7)
        $cookieHeaders = $conn->httpRequest->getHeader('Cookie'); // array of header lines
        if (empty($cookieHeaders)) {
            return null;
        }
        // Collapse multiple Cookie headers into one string, then scan pairs.
        $all = implode('; ', $cookieHeaders);
        foreach (explode(';', $all) as $pair) {
            $pair = trim($pair);
            if (stripos($pair, 'PHPSESSID=') === 0) {
                return trim(substr($pair, strlen('PHPSESSID=')));
            }
        }
        return null;
    }

    /** Resume the same PHP session Apache created, to read $_SESSION['user_id'] */
    private function resumePhpSessionAndGetUserId(string $sid): ?int
    {
        // If your CLI php.ini uses a different session.save_path than Apache,
        // you may need to align it here with ini_set('session.save_path', '...');

        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        session_id($sid);
        session_start();                 // opens the existing session file
        $userId = $_SESSION['user_id'] ?? null;
        session_write_close();           // release lock quickly
        return $userId ? (int)$userId : null;
    }

    private function verifyWsToken(string $token, string $secret): ?int
    {
        // Expect "<payload>.<sig>"
        $parts = explode('.', $token, 2);
        if (count($parts) !== 2) return null;
        [$p64, $s64] = $parts;

        $payloadJson = base64_decode(strtr($p64, '-_', '+/'), true);
        if ($payloadJson === false) return null;

        $payload = json_decode($payloadJson, true);
        if (!is_array($payload) || !isset($payload['uid'], $payload['exp'])) return null;

        // Recompute signature over the encoded payload
        $calc = base64_encode(hash_hmac('sha256', $p64, $secret, true));
        $calc = rtrim(strtr($calc, '+/', '-_'), '=');

        // Timing-safe compare
        if (!hash_equals($calc, $s64)) return null;

        // Expired?
        if ((int)$payload['exp'] < time()) return null;

        return (int)$payload['uid'];
    }
}
