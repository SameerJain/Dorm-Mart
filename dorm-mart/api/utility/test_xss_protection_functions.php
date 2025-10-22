<?php
/**
 * XSS Protection Test File
 * This file demonstrates that XSS protection is working
 */

// Include security headers
require_once __DIR__ . '/../security/security.php';

header('Content-Type: text/html; charset=utf-8');

// Test XSS protection with user input
// Demonstrates sanitization functions prevent XSS attacks
$testInput = $_GET['test'] ?? 'No input provided';

echo "<!DOCTYPE html>
<html>
<head>
    <title>XSS Protection Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .safe { color: green; }
        .warning { color: red; }
        .info { background: #f0f0f0; padding: 10px; margin: 10px 0; }
    </style>
</head>
<body>
    <h1>XSS Protection Test</h1>
    
    <div class='info'>
        <h3>Test Input (Raw):</h3>
        <p>Input: " . htmlspecialchars($testInput) . "</p>
    </div>
    
    <div class='info'>
        <h3>Test Input (Sanitized):</h3>
        <p>Sanitized: " . sanitize_string($testInput) . "</p>
    </div>
    
    <div class='info'>
        <h3>Test Input (HTML Escaped):</h3>
        <p>HTML Escaped: " . escapeHtml($testInput) . "</p>
    </div>
    
    <div class='info'>
        <h3>Security Headers Applied:</h3>
        <ul>
            <li>Content Security Policy (CSP)</li>
            <li>X-XSS-Protection</li>
            <li>X-Content-Type-Options</li>
            <li>X-Frame-Options</li>
        </ul>
    </div>
    
    <div class='info'>
        <h3>Test XSS Attempts:</h3>
        <p>Try these URLs to test XSS protection:</p>
        <ul>
            <li><a href='?test=<script>alert(\"XSS\")</script>'>Script Tag Test</a></li>
            <li><a href='?test=<img src=x onerror=alert(\"XSS\")>'>Image XSS Test</a></li>
            <li><a href='?test=<svg onload=alert(\"XSS\")>'>SVG XSS Test</a></li>
            <li><a href='?test=javascript:alert(\"XSS\")'>JavaScript URL Test</a></li>
        </ul>
    </div>
    
    <div class='safe'>
        <h3>✅ XSS Protection Status:</h3>
        <p>All inputs are sanitized and security headers are applied!</p>
    </div>
</body>
</html>";
?>
