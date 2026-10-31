<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
// OpenSSL reads its config when PHP starts, so XAMPP needs it in the child environment.
if (PHP_OS_FAMILY === 'Windows' && !getenv('OPENSSL_CONF')) {
    $config = dirname(PHP_BINARY) . '/extras/ssl/openssl.cnf';
    if (is_file($config)) {
        $process = proc_open([PHP_BINARY, __FILE__], [STDIN, STDOUT, STDERR], $pipes, null,
            array_merge(getenv(), ['OPENSSL_CONF' => $config]));
        exit(proc_close($process));
    }
}
require __DIR__ . '/../helpers/browser_push.php';
require dirname(__DIR__, 2) . '/vendor/autoload.php';
$keys = json_decode(file_get_contents(__DIR__ . '/fixtures/push_keys.json'), true);
putenv('PUSH_VAPID_PUBLIC_KEY=' . $keys['publicKey']);
putenv('PUSH_VAPID_PRIVATE_KEY=' . $keys['privateKey']);
putenv('PUSH_VAPID_SUBJECT=mailto:test@example.com');
$mock = new GuzzleHttp\Handler\MockHandler([new GuzzleHttp\Psr7\Response(201), new GuzzleHttp\Psr7\Response(410)]);
$handler = GuzzleHttp\HandlerStack::create($mock);
$history = [];
$handler->push(GuzzleHttp\Middleware::history($history));
$send = browser_push_sender(new GuzzleHttp\Client(['handler' => $handler]));
$row = ['endpoint' => 'https://fcm.googleapis.com/fcm/send/test-device', 'public_key' => $keys['publicKey'],
    'auth_token' => rtrim(strtr(base64_encode(str_repeat('a', 16)), '+/', '-_'), '=')];
$result = $send($row, 'test plaintext');
$request = $history[0]['request'];
if (!$result['success'] || $result['expired']
    || $request->getHeaderLine('Content-Encoding') !== 'aes128gcm'
    || !str_starts_with($request->getHeaderLine('Authorization'), 'vapid ')
    || str_contains((string)$request->getBody(), 'test plaintext')) {
    throw new RuntimeException('Push encryption/authentication integration failed');
}
if (!$send($row, 'test plaintext')['expired']) throw new RuntimeException('Expired subscription response was not recognized');
echo "PASS: real Web Push encryption, VAPID signing, successful and expired responses (no network)\n";
