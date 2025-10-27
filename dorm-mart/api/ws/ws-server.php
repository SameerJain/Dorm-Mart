<?php
// api/ws/ws-server.php

declare(strict_types=1);

// Autoload vendor libs (Ratchet, PSR-7)
require dirname(__DIR__, 2) . '/vendor/autoload.php';
require_once __DIR__ . '/DemoServer.php';
require_once __DIR__ . '/ChatServer.php';
use Ratchet\Http\HttpServer;
use Ratchet\Server\IoServer;
use Ratchet\WebSocket\WsServer;
use Ratchet\Session\SessionProvider;

// If your CLI php.ini differs from Apache’s and sessions end up elsewhere,
// uncomment and point to the same path Apache uses.
// ini_set('session.save_path', 'C:\\xampp\\tmp'); // <-- Windows example
// ini_set('session.save_path', '/var/lib/php/sessions'); // <-- Linux example

$chat = new ChatServer();

$port = 8081;
$address = '127.0.0.1';

// IoServer::factory(...) builds the TCP server and event loop.
// HttpServer wraps the WebSocket server with the HTTP Upgrade handshake.
// WsServer handles the WS protocol frames and hands messages to EchoApp.
$server = IoServer::factory(
    new HttpServer(
        new WsServer($chat)
    ),
    $port,              // Port the WS server listens on
    $address          // Bind all interfaces (localhost is fine for dev)
);


echo "Ratchet WebSocket listening on ws://127.0.0.1:$port\n";
$server->run(); // Blocks here; keep this process running while testing


