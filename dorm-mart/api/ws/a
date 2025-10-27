<?php
// api/ws-server.
$PROJECT_ROOT = dirname(__DIR__, 2);
if (file_exists($PROJECT_ROOT . '/vendor/autoload.php')) {
    require $PROJECT_ROOT . '/vendor/autoload.php';
} 

// the lifecycle interface (open/message/close/error)
use Ratchet\MessageComponentInterface;   
// represents a connected client
use Ratchet\ConnectionInterface;
// tcp server loop
use Ratchet\Server\IoServer;
// wraps WS in HTTP upgrade handshake            
use Ratchet\Http\HttpServer;
// websocket protocol handler
use Ratchet\WebSocket\WsServer;          

class ChatSocket implements MessageComponentInterface {

    // SplObjectStorage is a set of objects where each object can carry its own payload "metadaa"
    // clients holds all active connections and lets us attach metadata to each one.
    // $this->clients->attach($conn, ['user_id' => $userId]);
    private $clients;

    // helps quick lookup table so we can find the conenction for a given user_id fast
    // $this->byUser[$userId] = $conn;
    private $byUser = [];


    public function __construct() {
        // stores all live connections
        $this->clients = new \SplObjectStorage();     
    }

    // when a client connects, 
    public function onOpen(ConnectionInterface $conn): void {
        // Ratchet exposes the PSR-7 HTTP request that did the WS upgrade:
        // $conn->httpRequest is a Guzzle/PSR-7 Request object.
        $query = $conn->httpRequest->getUri()->getQuery();
        parse_str($query, $params);
        $userId = isset($params['user_id']) ? trim((string)$params['user_id']) : '';

        if ($userId === '') {
            $conn->send(json_encode(['op' => 'error', 'error' => 'missing_user_id']));
            $conn->close();
            return;
        }

        // Store the connection with its metadata.
        $this->clients->attach($conn, ['user_id' => $userId]);
        $this->byUser[$userId] = $conn;

        // Optional greeting so client knows it’s connected as this user.
        $conn->send(json_encode(['op' => 'chat socket welcomes ', 'user_id' => $userId]));

    }

    /**
     * Called whenever a client sends a text frame.
     * We expect JSON like:
     *   { "op": "message", "to": "<peerId>", "text": "hello" }
     */
    // websocket handles all kinds of messages within onMessage
    // $from represents a $conn object
    public function onMessage(ConnectionInterface $from, $msg) {

        // whatever the operation is, we validate the format and the user presense in the socket
        $data = json_decode($msg, true);
        if (!is_array($data) || !isset($data['op'])) {
            $from->send(json_encode(['op' => 'error', 'error' => 'bad_format']));
            return;
        }

        // Identify the sender from the metadata we attached in onOpen.
        $meta   = $this->clients[$from] ?? ['user_id' => ''];
        $sender = $meta['user_id'] ?? '';

        // depends on the type of message, we handle them here
        switch ($data['op']) {

            case 'message': {
                // Minimal validation for required fields.
                $to   = isset($data['to'])   ? (string)$data['to']   : '';
                $text = isset($data['text']) ? (string)$data['text'] : '';

                if ($to === '' || $text === '') {
                    $from->send(json_encode(['op' => 'error', 'error' => 'missing_fields']));
                    return;
                }

                // Send an acknowledgment back to the sender so the UI can mark "delivered".
                $from->send(json_encode([
                    'op'   => 'message_ack',
                    'to'   => $to,
                    'from' => $sender,
                    'text' => $text,
                    'ts'   => time() // Unix seconds (UI can pretty-print if needed)
                ]));

                // If the recipient is online, deliver the message instantly.
                if (isset($this->byUser[$to])) {
                    $this->byUser[$to]->send(json_encode([
                        'op'   => 'message',
                        'from' => $sender,
                        'to'   => $to,
                        'text' => $text,
                        'ts'   => time()
                    ]));
                }
                // If the recipient is offline, we do nothing here.
                // Your REST endpoint (create_message.php) already wrote it to the DB.
                break;
            }

            // You can add more operations later with the same envelope:
            // case 'typing': ...
            // case 'mark_read': ...
            // case 'presence': ...
            default:
                $from->send(json_encode(['op' => 'error', 'error' => 'unknown_op']));
        }
    }

    public function onClose(ConnectionInterface $conn)
    {
        if ($this->clients->contains($conn)) {
            $userId = $this->clients[$conn]['user_id'] ?? null;
            $this->clients->detach($conn);
            if ($userId && isset($this->byUser[$userId]) && $this->byUser[$userId] === $conn) {
                unset($this->byUser[$userId]);
            }
        }
    }

    public function onError(ConnectionInterface $conn, \Exception $e)
    {
        $conn->send(json_encode(['op' => 'error', 'error' => 'server_error']));
        $conn->close();
        // STDERR is visible in your terminal when you run php we-server.php
        fwrite(STDERR, "[WS ERROR] " . $e->getMessage() . PHP_EOL);
    }
}

// socket port, differentiate from php local port 8080
$port = 8081;                                         
// IoServer::factory wires the HTTP server → WebSocket protocol → your app
$server = IoServer::factory(
    new HttpServer(               // Handles the HTTP Upgrade request to WebSocket
        new WsServer(             // Handles WebSocket frames and pings/pongs
            new ChatApp()         // Your app with onOpen/onMessage/onClose/onError
        )
    ),
    $port                          // TCP port to listen on (ws://<host>:8081)
);

echo "Ratchet server running at ws://localhost:8081\n";
$server->run(); // Blocking loop; press Ctrl+C to stop.
