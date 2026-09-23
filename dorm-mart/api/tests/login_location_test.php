<?php
declare(strict_types=1);
require_once __DIR__ . '/../auth/device_history.php';

function check_location(bool $condition, string $message): void
{
    if (!$condition) { echo "FAIL: $message\n"; exit(1); }
}

$_SESSION = [];
foreach (['127.0.0.1' => 'local', '::1' => 'local', '::ffff:127.0.0.1' => 'local', '192.168.1.2' => 'private', '10.0.0.1' => 'private', 'fc00::1' => 'private', 'Unknown' => 'unknown', '8.8.8.8' => 'public'] as $ip => $scope) {
    check_location(login_ip_scope($ip) === $scope, "scope for $ip");
    if ($scope !== 'public') {
        check_location(login_ip_location($ip, static function () { throw new RuntimeException('Non-public IP sent to lookup'); }) === null, 'non-public location');
    }
}

$calls = 0;
$lookup = static function (string $ip) use (&$calls): array {
    $calls++;
    return ['success' => true, 'city' => 'Buffalo', 'region' => 'New York', 'country' => 'United States'];
};
check_location(login_ip_location('8.8.8.8', $lookup) === 'Buffalo, New York, United States', 'public IP lookup');
check_location(login_ip_location('8.8.8.8', $lookup) === 'Buffalo, New York, United States' && $calls === 1, 'successful lookups cached');
$_SERVER = ['REMOTE_ADDR' => '8.8.8.8'];
check_location(login_request_location() === 'Buffalo, New York, United States', 'missing proxy headers use IP fallback');
$_SERVER['HTTP_X_VERCEL_IP_CITY'] = 'New%20York';
check_location(login_request_location() === 'New York', 'proxy location preserved');

$failure = static function () use (&$calls): array { $calls++; return ['success' => false]; };
check_location(login_ip_location('1.1.1.1', $failure) === null, 'provider failure handled');
check_location(login_ip_location('1.1.1.1', $failure) === null && $calls === 2, 'failed lookups cached');
check_location(login_ip_location('8.8.4.4', static fn() => ['success' => true, 'city' => [], 'region' => null]) === null, 'malformed provider fields ignored');
check_location(login_ip_location('9.9.9.9', static function () { throw new RuntimeException('Lookup budget exceeded'); }) === null, 'history lookup budget bounded');
echo "PASS: IP scopes, public lookup, header fallback, caching, failures, and lookup budget\n";
