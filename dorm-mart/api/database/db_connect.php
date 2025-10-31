<?php

function db(): mysqli
{

    $root = dirname(__DIR__, 2);
    require_once $root . '/api/utility/load_env.php';
    load_env();

    $servername = getenv('DB_HOST');
    $dbname     = getenv('DB_NAME');
    $username   = getenv('DB_USERNAME');
    $password   = getenv('DB_PASSWORD');

    // db connection
    $conn = new mysqli($servername, $username, $password);

    // check if db connected successfully
    if ($conn->connect_error) {
        die(json_encode(["success" => false, "message" => "Connection failed: " . $conn->connect_error]));
    }

    // check if db exist, or create it
    $result = $conn->query("SHOW DATABASES LIKE '$dbname'");
    if ($result && $result->num_rows === 0) {
        // db doesn’t exist — create it
        if (!$conn->query("CREATE DATABASE `$dbname`")) {
            die(json_encode(["success" => false, "message" => "Failed to create database: " . $conn->error]));
        }
    }

    // select the database
    $conn->select_db($dbname);
    
    // ensure autocommit is enabled
    $conn->autocommit(true);
    
    // set timezone to UTC for consistent token expiration handling
    $conn->query("SET time_zone = '+00:00'");

    return $conn;
}
