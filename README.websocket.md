# Ratchet: PHP Websocket Library

## Installation
- installing Ratchet library requires Composer (package manager of PHP)
- install Composer if you don't have it yet
    - `php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"`
    - `php composer-setup.php`
    - `php -r "unlink('composer-setup.php');"`
    - `sudo mv composer.phar /usr/local/bin/composer`
- run `composer require cboden/ratchet` to install Ratchet package

## How Websocket works
1. Over TCP protocol, the client sends a special request via HTTP to the server
2. The special request is intented to initiate a handshake process with the running websocket
3. 

## How Ratchet works

### Runnning Ratchet websocket
Following classes are used to create a Ratchet server object and configure the server
```php
use Ratchet\Http\HttpServer;
use Ratchet\Server\IoServer;
use Ratchet\WebSocket\WsServer;
require_once __DIR__ . '/DemoServer.php'

// an server object to be run on Ratchet
$demo = new DemoServer();

// IoServer::factory(...) builds the TCP server and event loop.
// HttpServer wraps the WebSocket server with the HTTP Upgrade handshake.
// WsServer handles the WS protocol frames and hands messages to DemoApp.
$server = IoServer::factory(
    new HttpServer(
        new WsServer($demo)
    ),
    8080, // port the WS server listens on
    127.0.0.1 // Bind all interfaces 
)

```
### Defining DemoServer interfaces
Following Interfaces are used to define the behaviors of running server
```php
use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;

final class DemoServer implements MessageComponentInterface {

    // clients of type \SqlObjectStorage allows us to keep track of connected users and their metadata
    private $clients;
    public function __construct() {
        $this->clients = new \SplObjectStorage();
    }

    // Defining onOpen, OnMessage, onClose, and onError below are required to define the behaviors of DemoServer
 
    // onOpen handles HTTP upgrade handshakes, and store client's connection in clients
    public function onOpen(ConnectionInterface $conn): void {
        $this->clients->attach($conn, ['clientId' => $clientId]);
        // ack to the client
        $conn -> send(json_encode([
            'msg' => 'welcome to dorm-mart!'
        ], JSON_UNESCAPED_SLASHES));
    }

    // onMessage listens and handles client requests sent via socket
    public function onMessage(ConnectionInterface $from, $msg): void {   
        $data = json_decode(%msg, true);
        // if ping is received, respond with pong
        $type = $data['type'];
        if $type == 'ping':
            $from -> send(json_encode([
                "msg": "pong"
            ]))
    }

    // onClose handles when a client disconnects
    public function onClose(ConnectionInterface $conn): void
    {
        $this->clients->detach($conn);
    }

    public function onError(ConnectionInterface $conn, \Exception $e): void {
        // Any exception on this connection → close it
        $conn->close();
    }
}
```

# Conclusion
Now with the Ratchet server and the running server object, you can run the websocket server at 127.0.0.1:8081


# How React connects to Websocket

## 

## 

# 