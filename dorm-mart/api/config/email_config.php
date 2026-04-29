<?php
/**
 * Email Registration Policy Configuration
 *
 * Set ALLOW_ALL_EMAILS to true to allow any valid email address to register.
 * Set to false to restrict registration to @buffalo.edu addresses only.
 *
 * Note: Login will always accept any valid email to support existing non-UB accounts.
 */
require_once __DIR__ . '/app_config.php';

define('ALLOW_ALL_EMAILS', dm_env_bool('ALLOW_ALL_EMAILS', true));
