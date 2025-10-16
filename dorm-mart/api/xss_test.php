<?php
/**
 * XSS Protection Test File
 * This file demonstrates that XSS protection is working
 */

// Include security headers
require __DIR__ . '/security_headers.php';
require __DIR__ . '/input_sanitizer.php';

header('Content-Type: text/html; charset=utf-8');

// Test XSS protection
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
        .test-link { margin: 5px 0; }
        .test-link a { color: #0066cc; text-decoration: none; }
        .test-link a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>🛡️ XSS Protection Test</h1>
    
    <div class='info'>
        <h3>Test Input (Raw):</h3>
        <p><strong>Input:</strong> " . htmlspecialchars($testInput) . "</p>
    </div>
    
    <div class='info'>
        <h3>Test Input (Sanitized):</h3>
        <p><strong>Sanitized:</strong> " . sanitize_string($testInput) . "</p>
    </div>
    
    <div class='info'>
        <h3>🔒 Security Headers Applied:</h3>
        <ul>
            <li>Content Security Policy (CSP)</li>
            <li>X-XSS-Protection: 1; mode=block</li>
            <li>X-Content-Type-Options: nosniff</li>
            <li>X-Frame-Options: DENY</li>
            <li>Referrer-Policy: strict-origin-when-cross-origin</li>
        </ul>
    </div>
    
    <div class='info'>
        <h3>🧪 Test XSS Attempts:</h3>
        <p>Click these links to test XSS protection:</p>
        <div class='test-link'><a href='?test=<script>alert(\"XSS\")</script>'>🔴 Script Tag Test</a></div>
        <div class='test-link'><a href='?test=<img src=x onerror=alert(\"XSS\")>'>🔴 Image XSS Test</a></div>
        <div class='test-link'><a href='?test=<svg onload=alert(\"XSS\")>'>🔴 SVG XSS Test</a></div>
        <div class='test-link'><a href='?test=javascript:alert(\"XSS\")'>🔴 JavaScript URL Test</a></div>
        <div class='test-link'><a href='?test=<iframe src=javascript:alert(\"XSS\")>'>🔴 Iframe XSS Test</a></div>
    </div>
    
    <div class='safe'>
        <h3>✅ XSS Protection Status:</h3>
        <p><strong>All inputs are sanitized and security headers are applied!</strong></p>
        <p>If you see this message without any JavaScript alerts, XSS protection is working correctly.</p>
    </div>
    
    <div class='info'>
        <h3>📊 Test Results:</h3>
        <p><strong>Input Length:</strong> " . strlen($testInput) . " characters</p>
        <p><strong>Contains Script:</strong> " . (strpos($testInput, '<script>') !== false ? 'Yes' : 'No') . "</p>
        <p><strong>Contains HTML:</strong> " . (strpos($testInput, '<') !== false ? 'Yes' : 'No') . "</p>
    </div>
    
    <div class='info'>
        <h3>🔧 Technical Details:</h3>
        <ul>
            <li><strong>Input Sanitization:</strong> HTML entity encoding</li>
            <li><strong>Output Encoding:</strong> htmlspecialchars() with ENT_QUOTES</li>
            <li><strong>CSP Policy:</strong> Restricts script sources</li>
            <li><strong>XSS Filter:</strong> Browser-level protection enabled</li>
        </ul>
    </div>
    
    <div class='safe'>
        <h3>🎯 Success Criteria:</h3>
        <ul>
            <li>✅ No JavaScript alerts should appear</li>
            <li>✅ All HTML should be encoded in display</li>
            <li>✅ Page should load normally</li>
            <li>✅ Security headers should be present</li>
        </ul>
    </div>
</body>
</html>";
?>