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

    public function __construct()
    {
        $this->clients = new \SplObjectStorage();
    }

    public function onOpen(ConnectionInterface $conn): void {

        error_log('[ws] onOpen');

    if (!property_exists($conn, 'httpRequest') || !$conn->httpRequest) {
        error_log('[ws] no httpRequest on $conn — check your IoServer stack');
    } else {
        // Get the cookies as a single header line
        $cookieLine = $conn->httpRequest->getHeaderLine('Cookie');
        error_log('[ws] Cookie header line: ' . ($cookieLine === '' ? '(empty)' : $cookieLine));

        // Your existing extractor (keep it), just don’t echo arrays
        $sid = $this->extractPhpSessIdFromCookies($conn);
        error_log('[ws] PHPSESSID: ' . var_export($sid, true));
    }
    
        $sid = $this->extractPhpSessIdFromCookies($conn);
        if (!$sid) {
            $conn->send(json_encode(['type' => 'error', 'error' => 'no_session']));
            $conn->close();
            return;
        }

        $userId = $this->resumePhpSessionAndGetUserId($sid);
        if (!$userId) {
            $conn->send(json_encode(['type' => 'error', 'error' => 'not_authenticated']));
            $conn->close();
            return;
        }

        echo "passed";
        // store the client connection with tis metadata
        $this->clients->attach($conn. ['userId' => $userId]);
        echo $this->clients;
        // used for fast lookup
        $this->ByUserId[$userId] = $conn;
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
        $type = $data['type'];

        switch ($type) {
            case 'send_message':
                $fromUserId = $data['payload']['fromUserId'];
                $toUserId = $data['payload']['toUserId'];
                $content = $data['payload']['content'];

                $res = json_encode([
                    "type" => "new_message",
                    "payload" => [
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
        $userId = $this->clients[$conn]['userId'];
        $this->clients->detach($conn);
        unset($this->ByUserId[$userId]);
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
