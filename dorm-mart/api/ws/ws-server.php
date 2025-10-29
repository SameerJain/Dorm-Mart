<?php
// api/ws/ws-server.php

declare(strict_types=1);

// imports must be before other statements
use Ratchet\Http\HttpServer;
use Ratchet\Server\IoServer;
use Ratchet\WebSocket\WsServer;

// Autoload vendor libs (Ratchet, PSR-7)
$root = dirname(__DIR__, 2);
require_once $root . '/api/utility/load_env.php';
require_once $root . '/vendor/autoload.php';
require_once __DIR__ . '/DemoServer.php';
require_once __DIR__ . '/ChatServer.php';

load_env();

// If your CLI php.ini differs from Apache’s and sessions end up elsewhere,
// uncomment and point to the same path Apache uses.
// ini_set('session.save_path', 'C:\\xampp\\tmp'); // <-- Windows example
// ini_set('session.save_path', '/var/lib/php/sessions'); // <-- Linux example

$chat = new ChatServer();

$port = getenv('PHP_API_WS_PORT');
$address = getenv('PHP_API_WS_ADDRESS');

// validate envs
if ($port === false || !ctype_digit((string)$port)) {
    fwrite(STDERR, "[ws] Missing/invalid PHP_API_WS_PORT\n");
    exit(1);
}
if ($address === false || $address === '') {
    fwrite(STDERR, "[ws] Missing PHP_API_WS_ADDRESS\n");
    exit(1);
}

// IoServer::factory(...) builds the TCP server and event loop.
// HttpServer wraps the WebSocket server with the HTTP Upgrade handshake.
// WsServer handles the WS protocol frames and hands messages to EchoApp.
$server = IoServer::factory(
    new HttpServer(
        new WsServer($chat)
    ),
    (int)$port,              // Port the WS server listens on
    $address          // Bind all interfaces (localhost is fine for dev)
);

echo "Ratchet WebSocket listening on ws://{$address}:{$port}\n";
$server->run(); // Blocks here; keep this process running while testing


