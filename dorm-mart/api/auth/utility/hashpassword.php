<?php
/**
 * Password Hash Generator - Command Line Tool
 * 
 * Usage: 
 *   php hashpassword.php <password1> <password2> <password3> ...
 *
 * Examples:
 *   php hashpassword.php "1234!"
 *   php hashpassword.php "password1" "password2" "password3"
 *
 * Interactive Mode:
 *   php hashpassword.php
 *   (then enter passwords one by one, press Ctrl+C to exit)
 */

// Check if passwords were provided as arguments
if ($argc > 1) {
    // Batch mode - hash all provided passwords
    echo "Generating password hashes...\n";
    echo str_repeat("=", 80) . "\n\n";
    
    for ($i = 1; $i < $argc; $i++) {
        $password = $argv[$i];
        // Hash + salt using bcrypt (salt generated and embedded automatically)
        $hash = password_hash($password, PASSWORD_BCRYPT);
        
        echo "Password #{$i}: {$password}\n";
        echo "Hash:        {$hash}\n\n";
    }
    
    echo str_repeat("=", 80) . "\n";
    echo "Copy the hashes above into your SQL INSERT statements.\n";
    
} else {
    // Interactive mode - prompt for passwords one at a time
    echo "Password Hash Generator - Interactive Mode\n";
    echo str_repeat("=", 80) . "\n";
    echo "Enter passwords one at a time (press Ctrl+C to exit)\n\n";
    
    $count = 1;
    while (true) {
        echo "Enter password #{$count} (or press Ctrl+C to exit): ";
        $password = trim(fgets(STDIN));
        
        if ($password === '') {
            echo "Password cannot be empty. Try again.\n\n";
            continue;
        }
        
        // Hash + salt using bcrypt (salt generated and embedded automatically)
        $hash = password_hash($password, PASSWORD_BCRYPT);
        echo "Hash: {$hash}\n\n";
        
        $count++;
    }
}
?>