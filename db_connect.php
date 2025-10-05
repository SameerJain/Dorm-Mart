<?php
$servername = "localhost";
$username   = "anishban";   
$password   = 50457553;           
$database   = "cse442_2025_fall_team_j_db";     
$conn = new mysqli($servername, $username, $password, $database);
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
echo "Connected successfully";

$conn->query("CREATE TABLE IF NOT EXISTS Users(user_id INT PRIMARY KEY, first_name TEXT, last_name TEXT, email TEXT, grad_date VARCHAR(10), password_hash VARCHAR(255) NOT NULL, auth_has VARCHAR(255))");

return $conn;
?>
