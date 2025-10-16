# XSS Protection Tests for Postman

## 🧪 Test Collection: XSS Protection Validation

### Test 1: Login Endpoint XSS Protection
**Method**: POST  
**URL**: `{{base_url}}/api/auth/login.php`  
**Headers**:
```
Content-Type: application/json
```

**Test Cases**:

#### 1.1 Normal Login (Should Work)
```json
{
  "email": "testuser@buffalo.edu",
  "password": "1234!"
}
```
**Expected**: 200 OK with `{"ok":true}`

#### 1.2 XSS in Email Field
```json
{
  "email": "<script>alert('XSS')</script>@buffalo.edu",
  "password": "1234!"
}
```
**Expected**: 400 Bad Request (email validation should reject)

#### 1.3 XSS in Password Field
```json
{
  "email": "testuser@buffalo.edu",
  "password": "<script>alert('XSS')</script>"
}
```
**Expected**: 401 Unauthorized (password sanitized, login fails)

#### 1.4 SQL Injection Attempt
```json
{
  "email": "testuser@buffalo.edu",
  "password": "'; DROP TABLE users; --"
}
```
**Expected**: 401 Unauthorized (sanitized, login fails)

### Test 2: Create Account XSS Protection
**Method**: POST  
**URL**: `{{base_url}}/api/auth/create_account.php`  
**Headers**:
```
Content-Type: application/json
```

#### 2.1 XSS in First Name
```json
{
  "firstName": "<script>alert('XSS')</script>",
  "lastName": "Doe",
  "gradMonth": 12,
  "gradYear": 2025,
  "email": "testuser2@buffalo.edu",
  "promos": false
}
```
**Expected**: 200 OK (XSS sanitized, account created)

#### 2.2 XSS in Last Name
```json
{
  "firstName": "John",
  "lastName": "<img src=x onerror=alert('XSS')>",
  "gradMonth": 12,
  "gradYear": 2025,
  "email": "testuser3@buffalo.edu",
  "promos": false
}
```
**Expected**: 200 OK (XSS sanitized, account created)

### Test 3: Change Password XSS Protection
**Method**: POST  
**URL**: `{{base_url}}/api/auth/change_password.php`  
**Headers**:
```
Content-Type: application/json
Cookie: {{session_cookie}}
```

#### 3.1 XSS in Password Fields
```json
{
  "currentPassword": "<script>alert('XSS')</script>",
  "newPassword": "<svg onload=alert('XSS')>"
}
```
**Expected**: 401 Unauthorized (sanitized, authentication fails)

### Test 4: Security Headers Validation
**Method**: GET  
**URL**: `{{base_url}}/api/xss_test.php?test=<script>alert('XSS')</script>`  

**Expected Headers**:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ...
X-XSS-Protection: 1; mode=block
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

**Expected Response**: HTML page showing sanitized input (no script execution)

## 🔧 Postman Environment Variables

Create these variables in your Postman environment:

```
base_url: https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j
session_cookie: (get from successful login response)
```

## 📋 Test Scripts for Postman

### Login Test Script
```javascript
pm.test("XSS Protection - Login", function () {
    pm.response.to.have.status(200);
    pm.expect(pm.response.headers.get("Content-Security-Policy")).to.not.be.null;
    pm.expect(pm.response.headers.get("X-XSS-Protection")).to.eql("1; mode=block");
});

pm.test("Response contains no script tags", function () {
    pm.expect(pm.response.text()).to.not.include("<script>");
});
```

### Security Headers Test Script
```javascript
pm.test("Security Headers Present", function () {
    pm.expect(pm.response.headers.get("Content-Security-Policy")).to.not.be.null;
    pm.expect(pm.response.headers.get("X-XSS-Protection")).to.eql("1; mode=block");
    pm.expect(pm.response.headers.get("X-Content-Type-Options")).to.eql("nosniff");
    pm.expect(pm.response.headers.get("X-Frame-Options")).to.eql("DENY");
});
```

## 🎯 Success Criteria

✅ **All XSS attempts should be sanitized**  
✅ **Security headers should be present**  
✅ **No script execution in responses**  
✅ **Normal functionality still works**  
✅ **Error responses are properly formatted**  

## 🚀 Quick Test Commands

### Test XSS Protection
```bash
# Test with curl (alternative to Postman)
curl -X POST "https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/api/auth/login.php" \
  -H "Content-Type: application/json" \
  -d '{"email":"<script>alert(\"XSS\")</script>@buffalo.edu","password":"1234!"}'
```

### Test Security Headers
```bash
curl -I "https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/api/xss_test.php"
```
