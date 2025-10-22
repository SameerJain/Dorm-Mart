<?php
// Temporary Password Reset Page - Shows that the link is working
$token = $_GET['token'] ?? '';

// Check if token is valid and not expired
$isValidToken = false;
if (!empty($token)) {
    require_once __DIR__ . '/db_connect.php';
    $conn = db();
    
    // Check if token is valid and not expired
    $stmt = $conn->prepare('
        SELECT user_id, hash_auth, reset_token_expires 
        FROM user_accounts 
        WHERE hash_auth IS NOT NULL 
        AND reset_token_expires > NOW()
    ');
    $stmt->execute();
    $result = $stmt->get_result();
    
    while ($row = $result->fetch_assoc()) {
        if (password_verify($token, $row['hash_auth'])) {
            $isValidToken = true;
            break;
        }
    }
    
    $stmt->close();
    $conn->close();
    
    // If token is invalid or expired, redirect to expired page
    if (!$isValidToken) {
        // Detect environment and redirect to correct path
        $host = $_SERVER['HTTP_HOST'] ?? '';
        
        if (strpos($host, 'aptitude.cse.buffalo.edu') !== false) {
            header('Location: /CSE442/2025-Fall/cse-442j/api/reset-link-expired.php');
        } elseif (strpos($host, 'cattle.cse.buffalo.edu') !== false) {
            header('Location: /CSE442/2025-Fall/cse-442j/api/reset-link-expired.php');
        } else {
            // Local development
            header('Location: /serve/dorm-mart/api/reset-link-expired.php');
        }
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password - Dorm Mart</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #1e3a8a;
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 400px;
        }
        .logo {
            text-align: center;
            margin-bottom: 2rem;
        }
        .logo h1 {
            color: #333;
            margin: 0;
            font-size: 2rem;
        }
        .error {
            background: #fee;
            color: #c33;
            padding: 0.75rem;
            border-radius: 5px;
            margin-bottom: 1rem;
            border: 1px solid #fcc;
        }
        .success {
            background: #efe;
            color: #363;
            padding: 0.75rem;
            border-radius: 5px;
            margin-bottom: 1rem;
            border: 1px solid #cfc;
        }
        .back-to-login {
            text-align: center;
            margin-top: 1rem;
        }
        .back-to-login a {
            color: #667eea;
            text-decoration: none;
        }
        .back-to-login a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <h1>Dorm Mart</h1>
        </div>
        
        <?php if (empty($token)): ?>
            <div class="error">
                <strong>Invalid Reset Link</strong><br>
                No reset token provided. Please use the link from your email.
            </div>
        <?php else: ?>
            <div class="success">
                <h2>Reset Link Working!</h2>
                <p><strong>Token received:</strong> <?php echo htmlspecialchars(substr($token, 0, 20)) . '...'; ?></p>
                <p>This confirms the password reset link is working correctly.</p>
                <p><em>Note: This is a temporary page. The actual reset functionality will be implemented later.</em></p>
            </div>
        <?php endif; ?>
        
        <div class="back-to-login">
            <a href="/serve/dorm-mart/#/login">← Back to Login</a>
        </div>
    </div>
</body>
</html>
