<?php
// api/ws/ChatServer.php

declare(strict_types=1);

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;

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
}
