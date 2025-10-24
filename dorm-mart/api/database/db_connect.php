<?php

function db(): mysqli
{
    // dorm-mart/
    $root = dirname(dirname(__DIR__, 1));
    // load whichever exists 
    $devEnvFile = "$root/.env.development";
    $localEnvFile = "$root/.env.local";
    $prodEnvFile = "$root/.env.production";
    $cattleEnvFile = "$root/.env.cattle";

    // load whichever exists
    //! the order matters here
    //! make sure if you are running the app on some server, it has only one env file that it needs
    if (file_exists($devEnvFile)) {
        $envFile = $devEnvFile;
    } elseif (file_exists($localEnvFile)) {
        $envFile = $localEnvFile;
    } elseif (file_exists($prodEnvFile)) {
        $envFile = $prodEnvFile;
    } elseif (file_exists($cattleEnvFile)) {
        $envFile = $cattleEnvFile;
    } else {
        echo json_encode(["success" => false, "message" => "db_connect: No .env file found"]);
        exit;
    }

    // parse env file
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        // skipping comments or empty lines
        if ($line === '' || str_starts_with($line, '#')) continue;
        // parse kvs
        [$key, $value] = array_pad(explode('=', $line, 2), 2, '');
        putenv(trim($key) . '=' . trim($value));
    }

    $servername = getenv('DB_HOST');
    $dbname     = getenv('DB_NAME');
    $username   = getenv('DB_USERNAME');
    $password   = getenv('DB_PASSWORD');

    // db connection
    $conn = new mysqli($servername, $username, $password);

    if ($conn->connect_error) {
        die(json_encode(["success" => false, "message" => "Connection failed: " . $conn->connect_error]));
    }

    // --- Check if DB exists, create if missing ---
    $result = $conn->query("SHOW DATABASES LIKE '$dbname'");
    if ($result && $result->num_rows === 0) {
        // Database doesn’t exist — create it
        if (!$conn->query("CREATE DATABASE `$dbname`")) {
            die(json_encode(["success" => false, "message" => "Failed to create database: " . $conn->error]));
        }
    }

    // --- Select the database ---
    $conn->select_db($dbname);
    
    // Ensure autocommit is enabled
    $conn->autocommit(true);
    
    // Set timezone to match PHP timezone
    $conn->query("SET time_zone = '" . date('P') . "'");

    return $conn;
}
