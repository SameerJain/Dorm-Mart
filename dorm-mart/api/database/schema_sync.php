<?php
declare(strict_types=1);

/**
 * Declarative schema sync.
 *
 * schema/<table>.sql declares what one table should look like. There is no
 * migration ledger and no numbered files: edit a table's file, run
 * `php api/database/migrate_schema.php`, and the database is changed to match.
 *
 * How it works: the declared tables are created in a scratch database on the
 * same server, so MySQL itself normalises every type and default. Each live
 * table's SHOW CREATE TABLE is then diffed against its scratch twin and only
 * the differences are applied (new tables, added/changed/dropped columns,
 * indexes, foreign keys, CHECK constraints). Running it again changes nothing.
 *
 * A table file may also carry `INSERT IGNORE INTO ...` starter rows, which are
 * inserted whenever the table is empty.
 */

const SCHEMA_PHASE_DROP_CONSTRAINTS = 1;
const SCHEMA_PHASE_DROP_INDEXES = 2;
const SCHEMA_PHASE_COLUMNS = 3;
const SCHEMA_PHASE_INDEXES = 4;
const SCHEMA_PHASE_CREATE = 5;
const SCHEMA_PHASE_ADD_CONSTRAINTS = 6;

/** Split a SQL file into statements, ignoring comments and quoted text. */
function schema_split_statements(string $sql): array
{
    $statements = [];
    $buffer = '';
    $quote = null;
    $length = strlen($sql);

    for ($i = 0; $i < $length; $i++) {
        $ch = $sql[$i];

        if ($quote !== null) {
            $buffer .= $ch;
            if ($ch === '\\' && $quote !== '`' && $i + 1 < $length) {
                $buffer .= $sql[++$i];
            } elseif ($ch === $quote) {
                if ($quote !== '`' && ($sql[$i + 1] ?? '') === $quote) {
                    $buffer .= $sql[++$i];
                } else {
                    $quote = null;
                }
            }
            continue;
        }

        $next = $sql[$i + 1] ?? '';
        if ($ch === "'" || $ch === '"' || $ch === '`') {
            $quote = $ch;
            $buffer .= $ch;
        } elseif (($ch === '-' && $next === '-' && in_array($sql[$i + 2] ?? "\n", [' ', "\t", "\r", "\n"], true)) || $ch === '#') {
            $end = strpos($sql, "\n", $i);
            $i = $end === false ? $length : $end;
            $buffer .= "\n";
        } elseif ($ch === '/' && $next === '*') {
            $end = strpos($sql, '*/', $i + 2);
            $i = $end === false ? $length : $end + 1;
            $buffer .= ' ';
        } elseif ($ch === ';') {
            if (trim($buffer) !== '') {
                $statements[] = trim($buffer);
            }
            $buffer = '';
        } else {
            $buffer .= $ch;
        }
    }
    if (trim($buffer) !== '') {
        $statements[] = trim($buffer);
    }
    return $statements;
}

/**
 * Read one table file: its name, CREATE statement, starter rows and the
 * tables it references (for ordering).
 */
function schema_parse_table_file(string $file, string $sql): array
{
    $statements = schema_split_statements($sql);
    $create = array_shift($statements);
    if ($create === null
        || !preg_match('/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?\s*\(/i', $create, $m)
    ) {
        throw new RuntimeException(basename($file) . ' must start with a CREATE TABLE statement');
    }
    $name = $m[1];
    if (strcasecmp(basename($file, '.sql'), $name) !== 0) {
        throw new RuntimeException(basename($file) . " declares table '{$name}'; name the file after the table");
    }
    foreach ($statements as $statement) {
        if (!preg_match('/^INSERT\s/i', $statement)) {
            throw new RuntimeException(basename($file) . ': only INSERT statements may follow CREATE TABLE');
        }
    }

    preg_match_all('/REFERENCES\s+`?([A-Za-z0-9_]+)`?/i', $create, $refs);
    $deps = [];
    foreach ($refs[1] as $ref) {
        if (strcasecmp($ref, $name) !== 0) {
            $deps[strtolower($ref)] = $ref;
        }
    }

    return [
        'name' => $name,
        'file' => basename($file),
        'create' => $create,
        'seed' => $statements,
        'deps' => array_values($deps),
    ];
}

/** Load every schema/*.sql, keyed by lower-cased table name. */
function schema_load_tables(string $dir): array
{
    $files = glob(rtrim($dir, '/\\') . '/*.sql') ?: [];
    sort($files);
    if (!$files) {
        throw new RuntimeException("No table files found in {$dir}");
    }

    $tables = [];
    foreach ($files as $file) {
        $sql = file_get_contents($file);
        if ($sql === false) {
            throw new RuntimeException('Unable to read ' . basename($file));
        }
        $table = schema_parse_table_file($file, $sql);
        $key = strtolower($table['name']);
        if (isset($tables[$key])) {
            throw new RuntimeException("Table '{$table['name']}' is declared twice");
        }
        $tables[$key] = $table;
    }
    return $tables;
}

/** Dependency order: a table comes after every table it references. */
function schema_order_tables(array $tables): array
{
    $ordered = [];
    $state = [];
    $visit = function (string $key, array $path) use (&$visit, &$ordered, &$state, $tables): void {
        if (($state[$key] ?? 0) === 2) {
            return;
        }
        if (($state[$key] ?? 0) === 1) {
            throw new RuntimeException('Circular table references: ' . implode(' -> ', [...$path, $key]));
        }
        $state[$key] = 1;
        foreach ($tables[$key]['deps'] as $dep) {
            $depKey = strtolower($dep);
            if (!isset($tables[$depKey])) {
                throw new RuntimeException("{$tables[$key]['file']} references '{$dep}', which has no table file ()");
            }
            $visit($depKey, [...$path, $key]);
        }
        $state[$key] = 2;
        $ordered[$key] = $tables[$key];
    };
    foreach (array_keys($tables) as $key) {
        $visit($key, []);
    }
    return $ordered;
}

/** Break SHOW CREATE TABLE output into columns, indexes and constraints. */
function schema_parse_create(string $ddl): array
{
    $lines = preg_split('/\r?\n/', trim($ddl)) ?: [];
    array_shift($lines);
    $options = (string)array_pop($lines);

    $parsed = [
        'columns' => [],
        'primary' => null,
        'indexes' => [],
        'foreign_keys' => [],
        'checks' => [],
        'options' => trim(preg_replace('/\s*AUTO_INCREMENT=\d+/i', '', $options) ?? $options),
    ];

    foreach ($lines as $line) {
        $line = rtrim(trim($line), ',');
        if ($line === '') {
            continue;
        }
        if ($line[0] === '`') {
            preg_match('/^`((?:[^`]|``)+)`/', $line, $m);
            // MySQL prints "CHARACTER SET utf8mb4 COLLATE utf8mb4_x" for a column
            // added by ALTER but only "COLLATE utf8mb4_x" for the same column
            // from CREATE; the collation already names the charset.
            $parsed['columns'][$m[1]] = preg_replace('/ CHARACTER SET (\w+) (COLLATE \1_\w+)/', ' $2', $line, 1) ?? $line;
        } elseif (str_starts_with($line, 'PRIMARY KEY')) {
            $parsed['primary'] = $line;
        } elseif (preg_match('/^(?:UNIQUE |FULLTEXT |SPATIAL )?KEY `((?:[^`]|``)+)`/', $line, $m)) {
            $parsed['indexes'][$m[1]] = $line;
        } elseif (preg_match('/^CONSTRAINT `((?:[^`]|``)+)` FOREIGN KEY/', $line, $m)) {
            $parsed['foreign_keys'][$m[1]] = $line;
        } elseif (preg_match('/^CONSTRAINT `((?:[^`]|``)+)` CHECK/', $line, $m)) {
            $parsed['checks'][$m[1]] = $line;
        } elseif (str_starts_with($line, 'CHECK')) {
            $parsed['checks'][$line] = $line;
        }
    }
    return $parsed;
}

function schema_ident(string $name): string
{
    return '`' . str_replace('`', '``', $name) . '`';
}

/**
 * Operations that turn the live table into the declared one. Each is
 * ['phase', 'table', 'sql', 'note', 'destructive'].
 */
function schema_diff_table(string $table, array $live, array $want): array
{
    $ops = [];
    $t = schema_ident($table);
    $op = function (int $phase, string $clause, string $note, bool $destructive = false) use (&$ops, $table, $t): void {
        $ops[] = [
            'phase' => $phase,
            'table' => $table,
            'sql' => "ALTER TABLE {$t} {$clause}",
            'note' => $note,
            'destructive' => $destructive,
        ];
    };

    // Constraints that are gone or changed come off first (foreign keys may be
    // what keeps a column or index in place).
    foreach ($live['checks'] as $name => $line) {
        if (($want['checks'][$name] ?? null) !== $line) {
            $op(SCHEMA_PHASE_DROP_CONSTRAINTS, 'DROP CONSTRAINT ' . schema_ident($name), "drop check {$name}");
        }
    }
    foreach ($live['foreign_keys'] as $name => $line) {
        if (($want['foreign_keys'][$name] ?? null) !== $line) {
            $op(SCHEMA_PHASE_DROP_CONSTRAINTS, 'DROP FOREIGN KEY ' . schema_ident($name), "drop foreign key {$name}");
        }
    }

    foreach ($live['indexes'] as $name => $line) {
        if (!isset($want['indexes'][$name])) {
            $op(SCHEMA_PHASE_DROP_INDEXES, 'DROP INDEX ' . schema_ident($name), "drop index {$name}");
        }
    }

    $previous = null;
    foreach ($want['columns'] as $name => $line) {
        if (!isset($live['columns'][$name])) {
            $position = $previous === null ? 'FIRST' : 'AFTER ' . schema_ident($previous);
            $op(SCHEMA_PHASE_COLUMNS, "ADD COLUMN {$line} {$position}", "add column {$name}");
        } elseif ($live['columns'][$name] !== $line) {
            $op(SCHEMA_PHASE_COLUMNS, "MODIFY COLUMN {$line}", "change column {$name}");
        }
        $previous = $name;
    }
    foreach ($live['columns'] as $name => $line) {
        if (!isset($want['columns'][$name])) {
            $op(SCHEMA_PHASE_COLUMNS, 'DROP COLUMN ' . schema_ident($name), "drop column {$name}", true);
        }
    }

    if ($live['primary'] !== $want['primary']) {
        $drop = $live['primary'] !== null ? 'DROP PRIMARY KEY, ' : '';
        $add = $want['primary'] !== null ? 'ADD ' . $want['primary'] : '';
        if ($drop !== '' && $add === '') {
            $drop = 'DROP PRIMARY KEY';
        }
        $op(SCHEMA_PHASE_INDEXES, $drop . $add, 'change primary key');
    }
    foreach ($want['indexes'] as $name => $line) {
        if (!isset($live['indexes'][$name])) {
            $op(SCHEMA_PHASE_INDEXES, "ADD {$line}", "add index {$name}");
        } elseif ($live['indexes'][$name] !== $line) {
            // One statement, so a foreign key that relies on the index never loses it.
            $op(SCHEMA_PHASE_INDEXES, 'DROP INDEX ' . schema_ident($name) . ", ADD {$line}", "change index {$name}");
        }
    }

    foreach ($want['checks'] as $name => $line) {
        if (($live['checks'][$name] ?? null) !== $line) {
            $op(SCHEMA_PHASE_ADD_CONSTRAINTS, "ADD {$line}", "add check {$name}");
        }
    }
    foreach ($want['foreign_keys'] as $name => $line) {
        if (($live['foreign_keys'][$name] ?? null) !== $line) {
            $op(SCHEMA_PHASE_ADD_CONSTRAINTS, "ADD {$line}", "add foreign key {$name}");
        }
    }

    return $ops;
}

function schema_show_create(mysqli $conn, string $database, string $table): string
{
    $result = $conn->query('SHOW CREATE TABLE ' . schema_ident($database) . '.' . schema_ident($table));
    $row = $result->fetch_row();
    $result->free();
    return (string)$row[1];
}

function schema_live_tables(mysqli $conn, string $database): array
{
    $stmt = $conn->prepare(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'"
    );
    $stmt->bind_param('s', $database);
    $stmt->execute();
    $live = [];
    foreach ($stmt->get_result()->fetch_all(MYSQLI_NUM) as [$name]) {
        $live[strtolower($name)] = $name;
    }
    $stmt->close();
    return $live;
}

function schema_shadow_name(string $database): string
{
    return substr($database, 0, 54) . '__schema';
}

/** Create the declared tables in a scratch database; returns its name. */
function schema_build_shadow(mysqli $conn, string $database, array $ordered): string
{
    $shadow = schema_shadow_name($database);
    // Same defaults as the live database, so a table file that names no
    // collation gets the same one in both (MySQL 8+ defaults to utf8mb4_0900_ai_ci).
    $stmt = $conn->prepare('SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?');
    $stmt->bind_param('s', $database);
    $stmt->execute();
    [$charset, $collation] = $stmt->get_result()->fetch_row() ?? ['utf8mb4', 'utf8mb4_unicode_ci'];
    $stmt->close();
    try {
        $conn->query('DROP DATABASE IF EXISTS ' . schema_ident($shadow));
        $conn->query('CREATE DATABASE ' . schema_ident($shadow) . ' CHARACTER SET ' . schema_ident($charset) . ' COLLATE ' . schema_ident($collation));
    } catch (mysqli_sql_exception $e) {
        throw new RuntimeException('Schema sync needs permission to create a scratch database: ' . $e->getMessage(), 0, $e);
    }
    $conn->select_db($shadow);
    try {
        foreach ($ordered as $table) {
            $conn->query($table['create']);
        }
    } finally {
        $conn->select_db($database);
    }
    return $shadow;
}

/** Diff every declared table against the database. [ops, tables to create]. */
function schema_plan(mysqli $conn, string $database, array $ordered, array $live, ?string $shadow): array
{
    $ops = [];
    $creates = [];
    foreach ($ordered as $key => $table) {
        if (!isset($live[$key])) {
            $creates[$key] = $table['name'];
            $ops[] = [
                'phase' => SCHEMA_PHASE_CREATE,
                'table' => $table['name'],
                'sql' => $table['create'],
                'note' => 'create table',
                'destructive' => false,
            ];
            continue;
        }
        $want = schema_parse_create(schema_show_create($conn, (string)$shadow, $table['name']));
        $have = schema_parse_create(schema_show_create($conn, $database, $live[$key]));
        array_push($ops, ...schema_diff_table($live[$key], $have, $want));
    }

    // Stable by phase, keeping dependency order within a phase.
    $indexed = array_map(null, array_keys($ops), $ops);
    usort($indexed, fn($a, $b) => [$a[1]['phase'], $a[0]] <=> [$b[1]['phase'], $b[0]]);
    return [array_column($indexed, 1), $creates];
}

/**
 * Bring the database in line with the table files.
 *
 * $options: dry_run, prune, force_seed (table => bool), seeders (table => callable
 * (mysqli, bool $wasEmpty): ?string that tops up a table after its starter rows).
 */
function schema_sync_run(mysqli $conn, string $dir, array $options = []): array
{
    $dryRun = !empty($options['dry_run']);
    $prune = !empty($options['prune']);

    $tables = schema_load_tables($dir);
    $ordered = schema_order_tables($tables);

    $database = (string)$conn->query('SELECT DATABASE()')->fetch_row()[0];
    $live = schema_live_tables($conn, $database);

    $needsShadow = (bool)array_intersect_key($ordered, $live);
    $shadow = $needsShadow ? schema_build_shadow($conn, $database, $ordered) : null;

    $report = [
        'created' => [],
        'altered' => [],
        'dropped_tables' => [],
        'seeded' => [],
        'unmanaged' => [],
        'warnings' => [],
        'plan' => [],
    ];

    try {
        [$ops] = schema_plan($conn, $database, $ordered, $live, $shadow);

        foreach ($ops as $op) {
            $report['plan'][] = ($op['destructive'] ? '[destructive] ' : '') . $op['sql'];
            if (!$dryRun) {
                try {
                    $conn->query($op['sql']);
                } catch (mysqli_sql_exception $e) {
                    throw new RuntimeException("{$op['table']}: {$op['note']} failed: {$e->getMessage()}
{$op['sql']}", 0, $e);
                }
            }
            if ($op['note'] === 'create table') {
                $report['created'][] = $op['table'];
            } else {
                $report['altered'][$op['table']][] = $op['note'];
            }
        }

        // Starter rows and top-up seeders, for any table that is empty.
        foreach ($ordered as $key => $table) {
            $seeder = $options['seeders'][$key] ?? null;
            if (!$table['seed'] && $seeder === null) {
                continue;
            }
            $existed = isset($live[$key]);
            $isEmpty = !$existed || (int)$conn->query('SELECT COUNT(*) FROM ' . schema_ident($table['name']))->fetch_row()[0] === 0;
            if (!$isEmpty && empty($options['force_seed'][$key])) {
                continue;
            }
            if ($dryRun) {
                $report['seeded'][] = $table['name'] . ' (would seed)';
                continue;
            }
            if ($isEmpty) {
                foreach ($table['seed'] as $statement) {
                    $conn->query($statement);
                }
            }
            $note = $seeder !== null ? $seeder($conn, $isEmpty) : null;
            $report['seeded'][] = $table['name'] . ($note !== null && $note !== '' ? " ({$note})" : '');
        }

        // Tables in the database that no file declares.
        foreach ($live as $key => $name) {
            if (isset($tables[$key])) {
                continue;
            }
            if ($prune) {
                $report['plan'][] = '[destructive] DROP TABLE ' . schema_ident($name);
                if (!$dryRun) {
                    $conn->query('SET FOREIGN_KEY_CHECKS = 0');
                    try {
                        $conn->query('DROP TABLE ' . schema_ident($name));
                    } finally {
                        $conn->query('SET FOREIGN_KEY_CHECKS = 1');
                    }
                }
                $report['dropped_tables'][] = $name;
            } else {
                $report['unmanaged'][] = $name;
            }
        }

        // The database should now match: anything left means a file asks for
        // something the diff cannot express, which is worth knowing about.
        if (!$dryRun) {
            $shadow ??= schema_build_shadow($conn, $database, $ordered);
            [$remaining] = schema_plan($conn, $database, $ordered, schema_live_tables($conn, $database), $shadow);
            foreach ($remaining as $op) {
                $report['warnings'][] = "{$op['table']}: still differs after sync ({$op['note']})";
            }
        }
    } finally {
        $conn->select_db($database);
        $conn->query('DROP DATABASE IF EXISTS ' . schema_ident(schema_shadow_name($database)));
    }

    return $report;
}
