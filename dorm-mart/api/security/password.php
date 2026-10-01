<?php
// Password hashing.
// Endpoints load this through security.php.

// PASSWORD SECURITY

/** bcrypt work factor for account passwords. 12 is roughly 250 ms per hash in 2026. */
const PASSWORD_BCRYPT_COST = 12;

/** Hash a plain-text password with bcrypt. */
function hash_password($password) {
    return password_hash($password, PASSWORD_BCRYPT, ['cost' => PASSWORD_BCRYPT_COST]);
}

