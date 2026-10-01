# Archived Ratchet WebSocket Guide

> **Legacy documentation:** This guide describes a retired experiment built with the Ratchet PHP WebSocket library. Dorm Mart's production chat and real-time features do not use this stack. This file is retained only for historical reference.

## Install Ratchet

Ratchet requires [Composer](https://getcomposer.org/), the PHP dependency manager.

1. Install Composer if it is not already available:
   ```sh
   php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
   php composer-setup.php
   php -r "unlink('composer-setup.php');"
   sudo mv composer.phar /usr/local/bin/composer
   ```
2. Install Ratchet:
   ```sh
   composer require cboden/ratchet
   ```

## How WebSockets Work

1. The client establishes a TCP connection and sends an HTTP request to upgrade the connection to the WebSocket protocol.
2. The server confirms the protocol upgrade.
3. The client and server keep the connection open and exchange messages in real time.

## Create a Ratchet Server

The following example wraps a message handler in Ratchet's WebSocket and HTTP servers, then listens on port `8080`:

```php
<?php

use Ratchet\Http\HttpServer;
use Ratchet\Server\IoServer;
use Ratchet\WebSocket\WsServer;

require_once __DIR__ . '/DemoServer.php';

$demo = new DemoServer();

$server = IoServer::factory(
    new HttpServer(
        new WsServer($demo)
    ),
    8080,
    '0.0.0.0'
);

$server->run();
```

`IoServer` manages the TCP server and event loop, `HttpServer` performs the HTTP upgrade handshake, and `WsServer` processes WebSocket frames before passing messages to `DemoServer`.

## Define the Message Handler

A Ratchet message handler implements `MessageComponentInterface`. This simplified example stores active connections and responds to a `ping` message with `pong`:

```php
<?php

use Ratchet\ConnectionInterface;
use Ratchet\MessageComponentInterface;

final class DemoServer implements MessageComponentInterface
{
    private \SplObjectStorage $clients;

    public function __construct()
    {
        $this->clients = new \SplObjectStorage();
    }

    public function onOpen(ConnectionInterface $conn): void
    {
        $this->clients->attach($conn);
        $conn->send(json_encode([
            'type' => 'welcome',
            'message' => 'Welcome to Dorm Mart!',
        ]));
    }

    public function onMessage(ConnectionInterface $from, $msg): void
    {
        $data = json_decode($msg, true);

        if (($data['type'] ?? null) === 'ping') {
            $from->send(json_encode([
                'type' => 'pong',
                'message' => 'pong',
            ]));
        }
    }

    public function onClose(ConnectionInterface $conn): void
    {
        $this->clients->detach($conn);
    }

    public function onError(ConnectionInterface $conn, \Exception $e): void
    {
        $conn->close();
    }
}
```

## Run the Archived Server

1. Open the archived server directory, previously `api/ws`.
2. Run `php ws-server.php`.
3. Confirm that the terminal reports the listening address and port.

The referenced server files may no longer exist in the current application because this integration has been retired.

## Connect from a Browser

Browsers provide a native `WebSocket` API. The following example connects to the local server and logs incoming messages:

```js
export function connectSocket() {
  const socket = new WebSocket("ws://localhost:8080");

  socket.addEventListener("open", () => console.log("[ws] open"));

  socket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "pong") {
      console.log(data.message);
    }
  });

  socket.addEventListener("close", () => console.log("[ws] close"));
  socket.addEventListener("error", (error) => console.error("[ws] error", error));

  return socket;
}
```

Wait until the connection opens before sending a message:

```js
import { connectSocket } from "./ws";

export default function PingPage() {
  const socket = connectSocket();

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "ping" }));
  });

  return null;
}
```

This example is educational only. New Dorm Mart features should follow the application's current HTTP-based communication patterns.
