<?php
declare(strict_types=1);

// Declarative schema sync (api/database/schema_sync.php): parsing and diffing
// need no database; the last section edits table files against a scratch
// database on the local server and is skipped if none is reachable.

require_once __DIR__ . '/../database/schema_sync.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

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

function expect_throws(callable $fn, string $needle, string $message): void
{
    global $checks;
    $checks++;
    try {
        $fn();
    } catch (RuntimeException $e) {
        if (!str_contains($e->getMessage(), $needle)) {
            fwrite(STDERR, "FAIL: {$message}\nWrong error: {$e->getMessage()}\n");
            exit(1);
        }
        return;
    }
    fwrite(STDERR, "FAIL: {$message}\nNothing was thrown\n");
    exit(1);
}

// --- schema_split_statements ---
expect_same(
    schema_split_statements("-- note; with semicolon\nCREATE TABLE a (x INT COMMENT 'a;b''c'); /* c; */ INSERT INTO a VALUES (1);\n# done;\n"),
    ["CREATE TABLE a (x INT COMMENT 'a;b''c')", 'INSERT INTO a VALUES (1)'],
    'statements split on semicolons outside quotes and comments'
);
expect_same(schema_split_statements("  \n-- only a comment\n"), [], 'a comment-only file has no statements');

// --- schema_parse_table_file ---
$file = '/tmp/orders.sql';
$parsed = schema_parse_table_file($file, "CREATE TABLE IF NOT EXISTS `orders` (\n  id INT,\n  user_id INT,\n  FOREIGN KEY (user_id) REFERENCES Users(id),\n  FOREIGN KEY (id) REFERENCES orders(id)\n);\nINSERT IGNORE INTO orders (id) VALUES (1);");
expect_same($parsed['name'], 'orders', 'table name read from CREATE TABLE');
expect_same($parsed['deps'], ['Users'], 'dependencies exclude the table itself');
expect_same(count($parsed['seed']), 1, 'INSERT after CREATE is a starter row');
expect_throws(fn() => schema_parse_table_file('/tmp/other.sql', 'CREATE TABLE orders (id INT);'), "declares table 'orders'", 'file must be named after its table');
expect_throws(fn() => schema_parse_table_file($file, 'DROP TABLE orders;'), 'must start with a CREATE TABLE', 'first statement must be CREATE TABLE');
expect_throws(fn() => schema_parse_table_file($file, "CREATE TABLE orders (id INT);\nDELETE FROM orders;"), 'only INSERT', 'only INSERT may follow CREATE TABLE');

// --- schema_order_tables ---
$make = fn(string $name, array $deps) => ['name' => $name, 'file' => "{$name}.sql", 'deps' => $deps];
$order = array_keys(schema_order_tables([
    'c' => $make('c', ['b']), 'b' => $make('b', ['a']), 'a' => $make('a', []),
]));
expect_same($order, ['a', 'b', 'c'], 'referenced tables come first');
expect_throws(fn() => schema_order_tables(['a' => $make('a', ['b']), 'b' => $make('b', ['a'])]), 'Circular', 'circular references are rejected');
expect_throws(fn() => schema_order_tables(['a' => $make('a', ['ghost'])]), "references 'ghost'", 'a reference to an undeclared table is rejected');

// --- schema_parse_create + schema_diff_table ---
$ddl = function (array $lines): string {
    return "CREATE TABLE `t` (\n  " . implode(",\n  ", $lines) . "\n) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4";
};
$live = schema_parse_create($ddl([
    '`id` int(11) NOT NULL AUTO_INCREMENT', '`name` varchar(20) NOT NULL', '`old` int(11) DEFAULT NULL',
    'PRIMARY KEY (`id`)', 'KEY `idx_name` (`name`)', 'KEY `idx_gone` (`old`)',
    'CONSTRAINT `fk_a` FOREIGN KEY (`old`) REFERENCES `u` (`id`)', 'CONSTRAINT `chk_a` CHECK (`id` > 0)',
]));
expect_same(array_keys($live['columns']), ['id', 'name', 'old'], 'columns parsed');
expect_same(array_keys($live['indexes']), ['idx_name', 'idx_gone'], 'indexes parsed');
expect_same(array_keys($live['foreign_keys']), ['fk_a'], 'foreign keys parsed');
expect_same(array_keys($live['checks']), ['chk_a'], 'checks parsed');
expect_same(str_contains($live['options'], 'AUTO_INCREMENT'), false, 'table AUTO_INCREMENT counter is ignored');

expect_same(schema_diff_table('t', $live, $live), [], 'identical tables have no operations');

$want = schema_parse_create($ddl([
    '`id` int(11) NOT NULL AUTO_INCREMENT', '`name` varchar(40) NOT NULL', '`added` int(11) DEFAULT NULL',
    'PRIMARY KEY (`id`)', 'KEY `idx_name` (`name`,`added`)',
    'CONSTRAINT `chk_b` CHECK (`id` > 1)',
]));
$notes = array_map(fn($op) => $op['phase'] . ':' . $op['note'], schema_diff_table('t', $live, $want));
expect_same($notes, [
    '1:drop check chk_a', '1:drop foreign key fk_a',
    '2:drop index idx_gone',
    '3:change column name', '3:add column added', '3:drop column old',
    '4:change index idx_name',
    '6:add check chk_b',
], 'diff lists drops first, then columns, indexes, then constraints');
$ops = schema_diff_table('t', $live, $want);
expect_same($ops[3]['sql'], 'ALTER TABLE `t` MODIFY COLUMN `name` varchar(40) NOT NULL', 'changed column is modified in place');
expect_same($ops[4]['sql'], 'ALTER TABLE `t` ADD COLUMN `added` int(11) DEFAULT NULL AFTER `name`', 'new column is placed after its predecessor');
expect_same($ops[5]['destructive'], true, 'dropping a column is flagged destructive');
expect_same($ops[6]["sql"], 'ALTER TABLE `t` DROP INDEX `idx_name`, ADD KEY `idx_name` (`name`,`added`)', 'a changed index is replaced in one statement');

// --- against a scratch database ---
mysqli_report(MYSQLI_REPORT_OFF);
$host = getenv('DB_HOST') ?: '127.0.0.1';
if (!in_array(strtolower($host), ['127.0.0.1', 'localhost', '::1'], true)) {
    echo "PASS: {$checks} schema sync checks (database section skipped: DB_HOST is not local)\n";
    exit(0);
}
$scratch = 'dm_schema_sync_test_' . getmypid();
$conn = @new mysqli($host, getenv('DB_USERNAME') ?: 'root', getenv('DB_PASSWORD') ?: '');
if ($conn->connect_errno) {
    echo "PASS: {$checks} schema sync checks (database section skipped: no local database)\n";
    exit(0);
}
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . $scratch;
mkdir($dir);
$write = fn(string $name, string $sql) => file_put_contents("{$dir}/{$name}.sql", $sql);
$sync = fn(array $options = []) => schema_sync_run($conn, $dir, $options);
$columns = function (string $table) use ($conn, $scratch): array {
    $r = $conn->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='{$scratch}' AND TABLE_NAME='{$table}' ORDER BY ORDINAL_POSITION");
    return array_column($r->fetch_all(MYSQLI_NUM), 0);
};

// expect_same() calls exit(), which skips finally blocks, so a shutdown function
// is what guarantees the scratch databases go away after a failed check.
register_shutdown_function(static function () use ($conn, $scratch, $dir): void {
    $conn->query("DROP DATABASE IF EXISTS `{$scratch}`");
    $conn->query('DROP DATABASE IF EXISTS `' . schema_shadow_name($scratch) . '`');
    foreach (glob("{$dir}/*.sql") ?: [] as $leftover) {
        unlink($leftover);
    }
    @rmdir($dir);
});

{
    $conn->query("CREATE DATABASE `{$scratch}` CHARACTER SET utf8mb4");
    $conn->select_db($scratch);

    $write('owners', "CREATE TABLE owners (\n  owner_id INT NOT NULL AUTO_INCREMENT,\n  name VARCHAR(20) NOT NULL,\n  PRIMARY KEY (owner_id)\n) ENGINE=InnoDB;\nINSERT IGNORE INTO owners (owner_id, name) VALUES (1, 'starter');\n");
    $write('pets', "CREATE TABLE pets (\n  pet_id INT NOT NULL AUTO_INCREMENT,\n  owner_id INT NOT NULL,\n  nickname VARCHAR(20) NOT NULL,\n  PRIMARY KEY (pet_id),\n  CONSTRAINT fk_pet_owner FOREIGN KEY (owner_id) REFERENCES owners(owner_id) ON DELETE CASCADE\n) ENGINE=InnoDB;\n");

    $report = $sync();
    expect_same($report['created'], ['owners', 'pets'], 'tables are created, referenced table first');
    expect_same((int)$conn->query('SELECT COUNT(*) FROM owners')->fetch_row()[0], 1, 'starter rows are inserted into an empty table');
    expect_same($report['warnings'], [], 'a fresh sync converges');

    $conn->query("INSERT INTO pets (owner_id, nickname) VALUES (1, 'Rex')");
    $report = $sync();
    expect_same([$report['created'], $report['altered']], [[], []], 'syncing again changes nothing');
    expect_same((int)$conn->query('SELECT COUNT(*) FROM owners')->fetch_row()[0], 1, 'starter rows are not re-added to a populated table');

    $write('pets', str_replace("  nickname VARCHAR(20) NOT NULL,\n", "  nickname VARCHAR(20) NOT NULL,\n  color VARCHAR(10) NULL,\n", file_get_contents("{$dir}/pets.sql")));
    $report = $sync();
    expect_same($report['altered'], ['pets' => ['add column color']], 'a new column in the file is added');
    expect_same($columns('pets'), ['pet_id', 'owner_id', 'nickname', 'color'], 'the new column is in file order');

    $write('pets', str_replace('nickname VARCHAR(20)', 'nickname VARCHAR(40)', file_get_contents("{$dir}/pets.sql")));
    expect_same($sync()['altered'], ['pets' => ['change column nickname']], 'a changed column definition is applied');

    $dryRun = $sync(['dry_run' => true]);
    expect_same($dryRun['plan'], [], 'dry run on a synced database plans nothing');
    $write('pets', str_replace("  color VARCHAR(10) NULL,\n", '', file_get_contents("{$dir}/pets.sql")));
    $dryRun = $sync(['dry_run' => true]);
    expect_same(count($dryRun['plan']), 1, 'dry run reports the drop');
    expect_same(str_starts_with($dryRun['plan'][0], '[destructive]'), true, 'dry run marks the drop destructive');
    expect_same($columns('pets'), ['pet_id', 'owner_id', 'nickname', 'color'], 'dry run changes nothing');
    $sync();
    expect_same($columns('pets'), ['pet_id', 'owner_id', 'nickname'], 'a column removed from the file is dropped');
    expect_same((string)$conn->query('SELECT nickname FROM pets')->fetch_row()[0], 'Rex', 'existing rows survive every change');

    unlink("{$dir}/pets.sql");
    $report = $sync();
    expect_same([$report['unmanaged'], $report['dropped_tables']], [['pets'], []], 'a table without a file is reported, not dropped');
    $report = $sync(['prune' => true]);
    expect_same($report['dropped_tables'], ['pets'], '--prune drops tables without a file');
}

echo "PASS: {$checks} schema sync checks\n";
