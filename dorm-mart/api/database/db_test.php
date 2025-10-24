<?php
header('Content-Type: application/json');

$root = dirname(__DIR__, 2); // CSE-442j directory or your local project directory
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


// Connect
$conn = new mysqli($servername, $username, $password, $dbname);

// Always return JSON with a success flag
if ($conn->connect_error) {
    echo json_encode([
        "success" => false,
        "message" => "Database connection failed: " . $conn->connect_error
    ]);
} else {
    echo json_encode([
        "success" => true,
        "message" => "Database connection was successful"
    ]);
}

$conn->close();
?>