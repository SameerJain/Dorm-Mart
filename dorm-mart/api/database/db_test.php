<?php
header('Content-Type: application/json');

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
        echo json_encode(["success" => false, "message" => "db_text: No .env file found"]);
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