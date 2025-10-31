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
- it establishes a TCP connection
- client sends an HTTP request to upgrade to the websocket protocol
- server responds confirming the upgrade request
- client and server keep the TCP connection open
- client and server can communicate realtime by sending messages to each other via the connection

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
                'type' => 'pong',
                "msg" => "pong"
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
## How to run the server
- navigate to `api/ws`
- run `php ws-server.php`
- confirm `Ratchet WebSocket listening on address:port` message

## Conclusion
Now with the Ratchet server and the running DemoServer object, we can create a running websocket server which listens to client's requests and respond over the connection


# How React connects to Websocket
JavsScript (thus React) relies on browser provided websocket object
Follow along the demo code below how it is used to connect to the backend running websocket server
## Defining browser Websocket
Likewise how websocket interfaces were defined in MessageComponentInterface,
browser-side websocket also requires interface definitions
```js
export function connectSocket() {
    // this immediately sends a websocket handshake request to the specified url parameter
    ws = new WebSocket(ws://localhost:8080);

    // "open" liestens to the response expected from handshake confirmation
    ws.addEventListener("open",  () => console.log("[ws] open"));

    // "message" listens to the data sent over the websocket from the server
    ws.addEventListener("message", (e) => {
        let parsed = JSON.parse(e.data);
        if parsed[type] === 'pong':
            // prints response 'pong' returned by ping request
            console.log(parsed[msg]) 
    })

    // "close" handles disconnection 
    ws.addEventListener("close", () => console.log("[ws] close"));

    // "error" 
    ws.addEventListener("error", (e) => console.log("[ws] error", e));
    
    return ws;
}

```

## How to use the websocket connection on frontend to send data 

```js
import { connectSocket } from ./ws

// sends a ping message to websocket
export default function PingPage() {
    const s = connectSocket();
    const packet = JSON.stringify({ type: 'ping' });
    s.send(packet);
}
```

# Conclusion
Now we can connect to the backend-running websocket via connectSocket function. We will have formulate JSON data to send it over the connection to the socket. Then, we will use s.send to send the data.
