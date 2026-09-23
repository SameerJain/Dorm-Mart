<?php
/**
 * Read-only diagnostic for the login and account-creation rate limiters.
 *
 * Both limiters fail open by design: consume_rate_limit() and
 * consume_account_creation_attempt() swallow their exceptions and report "not
 * blocked", so a limiter that has stopped throttling looks identical from
 * outside to one that is simply not being tripped. This prints what the
 * black-box view cannot: each table's schema, its live rows, and the MySQL
 * session settings that decide how the timestamp columns round-trip.
 *
 * Read the rows first. Buckets stuck at an attempt count of 1 mean each request
 * is hashing to a fresh key rather than accumulating -- that is what a bad
 * rate_limit_client_ip() looks like, and how the Railway proxy-node bug was
 * found (every request arrived from a different 100.64.0.x node, so keying on
 * REMOTE_ADDR opened a new bucket every time).
 *
 * Run it against production with:
 *
 *     railway run --service MySQL -- php dorm-mart/scripts/diagnose_login_rate_limit.php
 *
 * It only reads. It prints no credentials -- connection details are taken from
 * the environment and never echoed.
 */

declare(strict_types=1);

$url = getenv('MYSQL_PUBLIC_URL') ?: getenv('MYSQL_URL');
if (!$url) {
    fwrite(STDERR, "No MYSQL_PUBLIC_URL / MYSQL_URL in the environment.\n");
    fwrite(STDERR, "Run this through: railway run --service MySQL -- php " . basename(__FILE__) . "\n");
    exit(1);
}

$parts = parse_url($url);
$host = getenv('RAILWAY_TCP_PROXY_DOMAIN') ?: ($parts['host'] ?? '');
$port = (int) (getenv('RAILWAY_TCP_PROXY_PORT') ?: ($parts['port'] ?? 3306));

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$conn = new mysqli(
    $host,
    $parts['user'] ?? 'root',
    urldecode($parts['pass'] ?? ''),
    ltrim($parts['path'] ?? '', '/') ?: 'railway',
    $port
);

function heading(string $text): void
{
    echo "\n" . $text . "\n" . str_repeat('-', strlen($text)) . "\n";
}

heading('server + session');
foreach (['VERSION()', '@@global.time_zone', '@@session.time_zone', 'UTC_TIMESTAMP()', 'NOW()', '@@explicit_defaults_for_timestamp'] as $expr) {
    $value = $conn->query("SELECT $expr AS v")->fetch_assoc()['v'] ?? 'NULL';
    printf("%-38s %s\n", $expr, $value);
}

foreach (['login_rate_limits', 'account_creation_rate_limits'] as $table) {
    heading($table);

    $exists = $conn->query("SHOW TABLES LIKE '" . $conn->real_escape_string($table) . "'");
    if (!$exists || !$exists->num_rows) {
        echo "*** TABLE MISSING ***\n";
        continue;
    }

    $columns = $conn->query("SHOW COLUMNS FROM `$table`");
    while ($column = $columns->fetch_assoc()) {
        printf("  %-24s %-12s null=%-4s default=%-8s extra=%s\n",
            $column['Field'], $column['Type'], $column['Null'],
            $column['Default'] ?? 'NULL', $column['Extra']);
    }

    $count = $conn->query("SELECT COUNT(*) AS n FROM `$table`")->fetch_assoc()['n'];
    echo "  rows: $count\n";

    // The live rows are the real evidence: if attempts never climb past 1, the
    // counter is being reset on every request rather than accumulating.
    $rows = $conn->query("SELECT * FROM `$table` ORDER BY 1 DESC LIMIT 5");
    while ($row = $rows->fetch_assoc()) {
        echo '    ' . json_encode($row) . "\n";
    }
}

heading('round-trip check: does UTC_TIMESTAMP() survive a TIMESTAMP column?');
// login_rate_limits.last_failed_attempt is TIMESTAMP (timezone-converted on
// read and write); account_creation_rate_limits.last_attempt_at is DATETIME
// (stored verbatim). Were the TIMESTAMP column ever to read back shifted, the
// limiter's 10-minute window test would always be true and attempts would reset
// to 1 every request. MySQL 9 and MariaDB 10.4 both round-trip it correctly, so
// this is a guard against a future engine or timezone change, not a known fault.
$conn->query('CREATE TEMPORARY TABLE _tz_probe (ts TIMESTAMP NULL DEFAULT NULL, dt DATETIME NULL DEFAULT NULL)');
$conn->query('INSERT INTO _tz_probe (ts, dt) VALUES (UTC_TIMESTAMP(), UTC_TIMESTAMP())');
$probe = $conn->query(
    'SELECT ts, dt,
            TIMESTAMPDIFF(SECOND, ts, UTC_TIMESTAMP()) AS ts_age_seconds,
            TIMESTAMPDIFF(SECOND, dt, UTC_TIMESTAMP()) AS dt_age_seconds,
            (ts < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE)) AS ts_looks_expired,
            (dt < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE)) AS dt_looks_expired
     FROM _tz_probe'
)->fetch_assoc();
foreach ($probe as $key => $value) {
    printf("  %-20s %s\n", $key, $value === null ? 'NULL' : $value);
}
echo "\n  Both *_age_seconds should be ~0 and both *_looks_expired should be 0.\n";
echo "  A large ts_age_seconds, or ts_looks_expired=1, means the window test is\n";
echo "  broken and no login lockout can ever fire.\n";
