<?php
/**
 * Password Hash Generator - Command Line Tool
 * 
 * COMMAND LINE USAGE:
 * ===================
 * 
 * Hash single password:
 *   php api/utility/hash_password.php "your_password_here"
 *   Example: php api/utility/hash_password.php "mypassword123"
 * 
 * Hash multiple passwords:
 *   php api/utility/hash_password.php "password1" "password2" "password3"
 *   Example: php api/utility/hash_password.php "admin123" "user456" "test789"
 * 
 * Interactive mode (enter passwords one by one):
 *   php api/utility/hash_password.php
 *   (then enter passwords one by one, press Ctrl+C to exit)
 * 
 * EXAMPLES:
 * =========
 * php api/utility/hash_password.php "mypassword123"
 * php api/utility/hash_password.php "admin123" "user456"
 * php api/utility/hash_password.php
 * 
 * NOTES:
 * ======
 * - Passwords are hashed using bcrypt (PHP's PASSWORD_BCRYPT)
 * - Salt is automatically generated and embedded in the hash
 * - Use quotes around passwords with special characters
 * - Copy the generated hashes into your SQL INSERT statements
 */

// Check if passwords were provided as arguments
if ($argc > 1) {
    // Batch mode - hash all provided passwords
    echo "Generating password hashes...\n";
    echo str_repeat("=", 80) . "\n\n";

    for ($i = 1; $i < $argc; $i++) {
        $password = $argv[$i];
        // Hash + salt using bcrypt (salt generated and embedded automatically)
        // Uses PHP's secure password hashing with bcrypt algorithm
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
