<?php

if (!function_exists('db')) {
/**
 * Open a connection to the app database.
 *
 * Failures throw rather than die(): a die() answered HTTP 200 and skipped the
 * caller's catch, so outages looked like successful responses. Callers' own
 * handlers, or the one set_security_headers() installs, turn this into a 500.
 */
function db(): mysqli
{
    $root = dirname(__DIR__, 2);
    require_once $root . '/api/security/security.php';
    
    require_once $root . '/api/utility/load_env.php';
    load_env();

    $servername = getenv('DB_HOST');
    $dbname     = getenv('DB_NAME');
    $username   = getenv('DB_USERNAME');
    $password   = getenv('DB_PASSWORD');

    if (empty($dbname) || $dbname === false) {
        error_log('db_connect: DB_NAME is not set or empty');
        throw new RuntimeException('Database configuration error');
    }

    $dbname = trim($dbname);

    if (!preg_match('/^[a-zA-Z0-9_-]+$/', $dbname)) {
        error_log('db_connect: DB_NAME contains invalid characters');
        throw new RuntimeException('Database configuration error');
    }

    try {
        $conn = new mysqli($servername, $username, $password);
    } catch (mysqli_sql_exception $e) {
        error_log('db_connect: Connection failed: ' . $e->getMessage());
        throw new RuntimeException('Database connection error', 0, $e);
    }

    if ($conn->connect_error) {
        error_log('db_connect: Connection failed: ' . $conn->connect_error);
        throw new RuntimeException('Database connection error');
    }

    // SQL INJECTION PROTECTION: Escape database name for use in SQL queries
    // While $dbname comes from environment (not user input), we still escape it for safety
    // Use real_escape_string for string values in LIKE, and backticks for identifiers
    $dbnameEscaped = $conn->real_escape_string($dbname);
    $result = $conn->query("SHOW DATABASES LIKE '$dbnameEscaped'");
    if ($result && $result->num_rows === 0) {
        if (!$conn->query("CREATE DATABASE `$dbname`")) {
            error_log('db_connect: Failed to create database: ' . $conn->error);
            throw new RuntimeException('Database initialization error');
        }
    }

    $conn->select_db($dbname);
    $conn->set_charset('utf8mb4');
    
    $conn->autocommit(true);
    
    // set timezone to UTC for consistent token expiration handling
    date_default_timezone_set('UTC'); 
    $conn->query("SET time_zone = '+00:00'");

    return $conn;
}
}
