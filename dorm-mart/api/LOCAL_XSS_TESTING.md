# 🧪 Local XSS Protection Testing Guide

## 🚀 **Quick Start - Test XSS Protection**

### **Step 1: Start Your Local Server**
```bash
# Terminal 1: Start PHP server
cd dorm-mart
php -S localhost:8080 -t .

# Terminal 2: Start React (if needed)
npm run start-local
```

### **Step 2: Test XSS Protection Endpoint**
Open your browser and visit:
```
http://localhost:8080/api/xss_test.php
```

**Expected Result**: You should see a test page with security information.

## 🎯 **Test Cases to Run**

### **Test 1: Basic XSS Protection**
**URL**: `http://localhost:8080/api/xss_test.php?test=<script>alert('XSS')</script>`

**What to Look For**:
- ✅ Page loads without JavaScript alert
- ✅ Input shows as `&lt;script&gt;alert('XSS')&lt;/script&gt;` (encoded)
- ✅ No script execution

### **Test 2: Image XSS Protection**
**URL**: `http://localhost:8080/api/xss_test.php?test=<img src=x onerror=alert('XSS')>`

**What to Look For**:
- ✅ No image loads
- ✅ No JavaScript alert
- ✅ Input shows encoded HTML

### **Test 3: Login Endpoint XSS**
**Method**: POST  
**URL**: `http://localhost:8080/api/auth/login.php`  
**Body** (JSON):
```json
{
  "email": "<script>alert('XSS')</script>@buffalo.edu",
  "password": "1234!"
}
```

**Expected Result**:
- ✅ 400 Bad Request (email validation rejects XSS)
- ✅ No script execution
- ✅ Error message is safe

### **Test 4: Account Creation XSS**
**Method**: POST  
**URL**: `http://localhost:8080/api/auth/create_account.php`  
**Body** (JSON):
```json
{
  "firstName": "<script>alert('XSS')</script>",
  "lastName": "Doe",
  "gradMonth": 12,
  "gradYear": 2025,
  "email": "testuser@buffalo.edu",
  "promos": false
}
```

**Expected Result**:
- ✅ 200 OK (XSS sanitized, account created)
- ✅ No script execution
- ✅ First name is HTML-encoded in database

## 🔍 **Manual Testing with Browser**

### **Test 1: XSS Test Page**
1. Go to `http://localhost:8080/api/xss_test.php`
2. Try these URLs:
   - `?test=<script>alert('XSS')</script>`
   - `?test=<img src=x onerror=alert('XSS')>`
   - `?test=<svg onload=alert('XSS')>`
   - `?test=javascript:alert('XSS')`

**Success Criteria**:
- No JavaScript alerts appear
- All inputs are HTML-encoded in the display
- Page loads normally

### **Test 2: Security Headers Check**
1. Open browser Developer Tools (F12)
2. Go to Network tab
3. Visit `http://localhost:8080/api/auth/login.php`
4. Check response headers for:
   - `Content-Security-Policy`
   - `X-XSS-Protection: 1; mode=block`
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`

## 🛠️ **Using Postman for Testing**

### **Import Collection**
1. Open Postman
2. Click "Import"
3. Select `api/postman-tests/Dorm-Mart-XSS-Tests.postman_collection.json`
4. Set environment variable `base_url` to `http://localhost:8080`

### **Run Tests**
1. Select the collection
2. Click "Run" button
3. All tests will execute automatically
4. Check results - all should pass

## 🐛 **Troubleshooting**

### **If XSS Test Page Doesn't Load**
```bash
# Check if PHP server is running
curl http://localhost:8080/api/xss_test.php
```

### **If Security Headers Missing**
- Check that `security_headers.php` is included
- Verify file path is correct
- Check PHP error logs

### **If XSS Still Executes**
- Check browser console for CSP violations
- Verify input sanitization is working
- Test with different browsers

## 📊 **Expected Results Summary**

| Test Case | Expected Result | Status |
|-----------|----------------|---------|
| Script Tag XSS | No alert, HTML encoded | ✅ |
| Image XSS | No image load, HTML encoded | ✅ |
| SVG XSS | No alert, HTML encoded | ✅ |
| JavaScript URL | No execution, sanitized | ✅ |
| Login XSS | 400 error, no execution | ✅ |
| Account XSS | 200 OK, sanitized | ✅ |
| Security Headers | All headers present | ✅ |

## 🎯 **Success Criteria**

✅ **All XSS attempts are blocked**  
✅ **Security headers are present**  
✅ **No script execution occurs**  
✅ **Normal functionality works**  
✅ **All inputs are properly encoded**  

## 🚨 **What to Watch For**

### **Red Flags (XSS Protection Failed)**
- JavaScript alerts appear
- Scripts execute in browser
- Raw HTML appears in responses
- Security headers missing
- Database contains unencoded HTML

### **Green Flags (XSS Protection Working)**
- No JavaScript execution
- All inputs HTML-encoded
- Security headers present
- Normal functionality preserved
- Error messages are safe

## 📝 **Testing Checklist**

- [ ] XSS test page loads
- [ ] Script tags are encoded
- [ ] Image XSS is blocked
- [ ] SVG XSS is blocked
- [ ] JavaScript URLs are sanitized
- [ ] Login endpoint rejects XSS
- [ ] Account creation sanitizes XSS
- [ ] Security headers present
- [ ] No console errors
- [ ] Normal functionality works
