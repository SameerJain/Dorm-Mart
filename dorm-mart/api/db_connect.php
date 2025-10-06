<?php

$root = dirname(__DIR__); // CSE-442j directory or your local project directory
// load whichever exists 
$devEnvFile = "$root/.env.development";
$prodEnvFile = "$root/.env.production";
 
// load whichever exists
if (file_exists($devEnvFile)) {
    $envFile = $devEnvFile;
} elseif (file_exists($prodEnvFile)) {
    $envFile = $prodEnvFile;
} else {
    echo json_encode(["success" => false, "message" => "No .env file found"]);
    exit;
}

// parse env file
$lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
foreach ($lines as $line) {
    $line = trim($line);
    if ($line === '' || str_starts_with($line, '#')) continue;
    [$key, $value] = array_pad(explode('=', $line, 2), 2, '');
    putenv(trim($key) . '=' . trim($value));
}

$servername = getenv('DB_HOST');
$dbname     = getenv('DB_NAME');
$username   = getenv('DB_USERNAME');
$password   = getenv('DB_PASSWORD');

// db connection
$conn = new mysqli($servername, $username, $password, $dbname);

?>