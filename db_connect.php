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
?>
