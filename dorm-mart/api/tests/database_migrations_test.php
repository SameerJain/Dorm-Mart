<?php
declare(strict_types=1);

// The database workflow end to end, on a scratch database: schema/ builds from
// nothing and then converges, and migrate_data.php resets the test fixtures
// without touching real users' data. Skipped when no local database is reachable.

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../utility/load_env.php';
load_env();

$root = dirname(__DIR__, 2);
$checks = 0;

function expect_same($actual, $expected, string $message): void
{
    global $checks;
    $checks++;
    if ($actual !== $expected) {
        fwrite(STDERR, "FAIL: {$message}\nExpected: " . var_export($expected, true)
            . "\nActual: " . var_export($actual, true) . "\n");
        exit(1);
    }
}

$host = strtolower((string)getenv('DB_HOST'));
if (!in_array($host, ['127.0.0.1', 'localhost', '::1'], true)) {
    echo "PASS: 0 database migration checks (skipped: DB_HOST is not local)\n";
    exit(0);
}
mysqli_report(MYSQLI_REPORT_OFF);
$conn = @new mysqli($host, (string)getenv('DB_USERNAME'), (string)getenv('DB_PASSWORD'));
if ($conn->connect_errno) {
    echo "PASS: 0 database migration checks (skipped: no local database)\n";
    exit(0);
}
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$database = 'dm_migrations_test_' . bin2hex(random_bytes(6));
// expect_same() calls exit(), which skips finally blocks; a shutdown function is
// what guarantees the scratch databases go away after a failed check.
register_shutdown_function(static function () use ($conn, $database): void {
    $conn->query("DROP DATABASE IF EXISTS `{$database}`");
    $conn->query("DROP DATABASE IF EXISTS `{$database}__schema`");
});
$conn->query("CREATE DATABASE `{$database}` CHARACTER SET utf8mb4");
$conn->select_db($database);

/** Run one of the CLI scripts against the scratch database. [exit code, stdout, stderr] */
function run_script(string $script, array $args = []): array
{
    global $root, $database;
    $process = proc_open(
        [PHP_BINARY, $script, ...$args],
        [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
        $pipes,
        $root,
        // load_env() never overrides a variable that is already set.
        array_merge(getenv(), ['DB_NAME' => $database])
    );
    $out = stream_get_contents($pipes[1]);
    $err = stream_get_contents($pipes[2]);
    return [proc_close($process), $out, $err];
}

function table_counts(mysqli $conn, string $database): array
{
    $counts = [];
    $names = $conn->query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '{$database}' ORDER BY 1");
    foreach (array_column($names->fetch_all(MYSQLI_NUM), 0) as $table) {
        $counts[$table] = (int)$conn->query("SELECT COUNT(*) FROM `{$table}`")->fetch_row()[0];
    }
    return $counts;
}

function count_where(mysqli $conn, string $sql): int
{
    return (int)$conn->query($sql)->fetch_row()[0];
}

// --- schema/ builds from nothing and converges --------------------------------
[$code, $out, $err] = run_script('api/database/migrate_schema.php');
expect_same($code, 0, "migrate_schema.php succeeds on an empty database\n{$err}");
$report = json_decode($out, true);
expect_same($report['warnings'], [], 'a fresh sync leaves nothing still differing');
$declared = array_map(fn($f) => strtolower(basename($f, '.sql')), glob($root . '/schema/*.sql'));
$created = array_map('strtolower', $report['created']);
sort($declared);
sort($created);
expect_same($created, $declared, 'every schema/<table>.sql becomes exactly one table');

[$code, $out] = run_script('api/database/migrate_schema.php');
$report = json_decode($out, true);
expect_same([$code, $report['created'], $report['altered'], $report['plan']], [0, [], [], []], 'syncing again changes nothing');

// --- real data survives a seed reset -----------------------------------------
$conn->query(
    "INSERT INTO user_accounts (first_name, last_name, grad_month, grad_year, email, promotional, hash_pass, hash_auth, seller, theme, role) VALUES
       ('Real', 'One', 5, 2027, 'real.one@buffalo.edu', 0, 'x', 'y', 1, 'light', 'user'),
       ('Real', 'Two', 5, 2027, 'real.two@buffalo.edu', 0, 'x', 'y', 1, 'light', 'user'),
       ('Mod', 'Erator', 5, 2027, 'moderator@buffalo.edu', 0, 'x', 'y', 0, 'light', 'moderator')"
);
$one = (int)$conn->query("SELECT user_id FROM user_accounts WHERE email = 'real.one@buffalo.edu'")->fetch_row()[0];
$two = (int)$conn->query("SELECT user_id FROM user_accounts WHERE email = 'real.two@buffalo.edu'")->fetch_row()[0];
$conn->query("INSERT INTO INVENTORY (title, seller_id, item_status) VALUES ('REAL LISTING', {$one}, 'Active')");
$listing = (int)$conn->insert_id;
$conn->query("INSERT INTO wishlist (user_id, product_id) VALUES ({$two}, {$listing})");
$conn->query("INSERT INTO conversations (user1_id, user2_id, user1_fname, user2_fname, product_id) VALUES ({$one}, {$two}, 'Real', 'Real', {$listing})");
$conversation = (int)$conn->insert_id;
$conn->query("INSERT INTO messages (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content) VALUES ({$conversation}, {$one}, {$two}, 'Real', 'Real', 'hello real')");

[$code, $out, $err] = run_script('api/database/migrate_data.php');
expect_same($code, 0, "migrate_data.php succeeds\n{$err}");
$seedAccounts = count_where($conn, 'SELECT COUNT(*) FROM user_accounts WHERE is_protected = 1');
expect_same($seedAccounts > 0, true, 'fixture accounts are created and protected');

$before = table_counts($conn, $database);

// A tester added a listing while logged in as a fixture account.
$tester = (int)$conn->query("SELECT user_id FROM user_accounts WHERE email = 'testuser@buffalo.edu'")->fetch_row()[0];
$conn->query("INSERT INTO INVENTORY (title, seller_id, item_status) VALUES ('TESTER LEFTOVER', {$tester}, 'Active')");

[$code, $out, $err] = run_script('api/database/migrate_data.php');
expect_same($code, 0, "migrate_data.php succeeds when rerun\n{$err}");
$after = table_counts($conn, $database);

expect_same(count_where($conn, "SELECT COUNT(*) FROM user_accounts WHERE email LIKE 'real.%'"), 2, 'real accounts survive a seed reset');
expect_same(count_where($conn, "SELECT COUNT(*) FROM user_accounts WHERE role = 'moderator'"), 1, 'moderators survive a seed reset');
expect_same(count_where($conn, "SELECT COUNT(*) FROM INVENTORY WHERE title = 'REAL LISTING'"), 1, 'real listings survive a seed reset');
expect_same(count_where($conn, "SELECT COUNT(*) FROM wishlist WHERE user_id = {$two}"), 1, 'real wishlist rows survive a seed reset');
expect_same(count_where($conn, "SELECT COUNT(*) FROM messages WHERE content = 'hello real'"), 1, 'real chats survive a seed reset');
expect_same(count_where($conn, "SELECT COUNT(*) FROM INVENTORY WHERE title = 'TESTER LEFTOVER'"), 0, 'what a tester added to a fixture account is reset');
expect_same($after, $before, 'rerunning the fixtures leaves every table the same size');

// Fixtures only fill tables; they never change the schema.
$report =json_decode(run_script('api/database/migrate_schema.php')[1], true);
expect_same([$report['created'], $report['altered'], $report['warnings']], [[], [], []], 'schema is still in sync after the fixtures run');

echo "PASS: {$checks} database migration checks\n";
