<?php

require __DIR__ . '/db_connect.php';

// Test user data
$email = 'student@buffalo.edu';
$password = 'SecurePass123!';
$firstName = 'Test';
$lastName = 'Student';
$gradMonth = 5;
$gradYear = 2026;

try {
    $conn = db();
    
    // Check if user already exists
    $stmt = $conn->prepare('SELECT user_id FROM user_accounts WHERE email = ? LIMIT 1');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        echo "User already exists: $email\n";
        exit;
    }
    
    // Hash the password
    $hashPass = password_hash($password, PASSWORD_DEFAULT);
    
    // Insert the test user
    $sql = 'INSERT INTO user_accounts
              (first_name, last_name, grad_month, grad_year, email, promotional, hash_pass, hash_auth, join_date, seller, theme)
            VALUES
              (?, ?, ?, ?, ?, 0, ?, NULL, CURRENT_DATE, 0, 0)';
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('ssiiss', $firstName, $lastName, $gradMonth, $gradYear, $email, $hashPass);
    
    if ($stmt->execute()) {
        echo "Test user created successfully!\n";
        echo "Email: $email\n";
        echo "Password: $password\n";
    } else {
        echo "Failed to create test user: " . $conn->error . "\n";
    }
    
    $stmt->close();
    $conn->close();
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

?>
