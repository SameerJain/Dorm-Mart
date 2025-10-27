<?php
// api/ws-server.php
declare(strict_types=1);

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../auth/auth_handle.php';
// setSecurityHeaders();
// // Ensure CORS headers are present for React dev server and local PHP server
// setSecureCORS();
// auth_boot_session();

$PROJECT_ROOT = dirname(__DIR__, 2);
if (file_exists($PROJECT_ROOT . '/vendor/autoload.php')) {
    require $PROJECT_ROOT . '/vendor/autoload.php';
} 

// Minimal “echo” app: respond "pong" if client sends "ping"
final class DemoServer implements MessageComponentInterface {

    public function onOpen(ConnectionInterface $conn): void {

        // once a client joins ws, welcomes them
        $conn -> send(json_encode([
            'type' => 'hello',
            'payload' => ['msg' => 'welcome to dorm-mart!']
        ], JSON_UNESCAPED_SLASHES));
    }

    public function onMessage(ConnectionInterface $from, $msg): void {
        $data = json_decode($msg, true);
        $type = $data['type'];

        switch ($type) {
            case 'ping':
                $from -> send(json_encode([
                    "type" =>  'pong',
                    "payload" => ['msg' => 'pong']
                ], JSON_UNESCAPED_SLASHES));
                break;
            
            case 'message':
                $from -> send(json_encode([
                    "type" => 'message',
                    'payload' => ['msg' => $data['payload']['msg']]
                ], JSON_UNESCAPED_SLASHES));
                break;
        }
    }

    public function onClose(ConnectionInterface $conn): void {
        // Called when a client disconnects (no-op)
    }

    public function onError(ConnectionInterface $conn, \Exception $e): void {
        // Any exception on this connection → close it
        $conn->close();
    }
}