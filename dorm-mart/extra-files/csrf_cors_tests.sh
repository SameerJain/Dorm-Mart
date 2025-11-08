#!/bin/bash
# CSRF/CORS Test Suite for Aptitude
# Usage: bash csrf_cors_tests.sh

BASE_URL="https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j"
COOKIE_FILE="cookies.txt"

echo "=== CSRF/CORS Test Suite ==="
echo ""

# Test 1: CSRF Token Endpoint
echo "Test 1: CSRF Token Endpoint (Happy Path)"
curl -s -X GET "${BASE_URL}/api/auth/get-csrf-token.php"
echo -e "\n"

# Test 2: Change Password Without CSRF Token
echo "Test 2: Change Password Without CSRF Token (Happy Path)"
curl -s -X POST "${BASE_URL}/api/auth/change_password.php" \
  -H "Content-Type: application/json" \
  --cookie-jar "${COOKIE_FILE}" --cookie "${COOKIE_FILE}" \
  -d '{"currentPassword":"old","newPassword":"N3w!Passw0rd!"}'
echo -e "\n"

# Test 3: Change Password With Invalid CSRF Token
echo "Test 3: Change Password With Invalid CSRF Token (Alternate Path)"
curl -s -X POST "${BASE_URL}/api/auth/change_password.php" \
  -H "Content-Type: application/json" \
  --cookie-jar "${COOKIE_FILE}" --cookie "${COOKIE_FILE}" \
  -d '{"currentPassword":"old","newPassword":"N3w!Passw0rd!","csrf_token":"invalid"}'
echo -e "\n"

# Test 4: Create Product Listing Without CSRF Token
echo "Test 4: Create Product Listing Without CSRF Token (Happy Path)"
curl -s -X POST "${BASE_URL}/api/seller-dashboard/product_listing.php" \
  --cookie-jar "${COOKIE_FILE}" --cookie "${COOKIE_FILE}" \
  -F "mode=create" \
  -F "title=Desk" \
  -F "price=50" \
  -F "categories[]=Furniture" \
  -F "itemLocation=North Campus" \
  -F "condition=New"
echo -e "\n"

# Test 5: Create Product Listing With Invalid CSRF Token
echo "Test 5: Create Product Listing With Invalid CSRF Token (Alternate Path)"
curl -s -X POST "${BASE_URL}/api/seller-dashboard/product_listing.php" \
  --cookie-jar "${COOKIE_FILE}" --cookie "${COOKIE_FILE}" \
  -F "mode=create" \
  -F "title=Desk" \
  -F "price=50" \
  -F "categories[]=Furniture" \
  -F "itemLocation=North Campus" \
  -F "condition=New" \
  -F "csrf_token=invalid"
echo -e "\n"

# Test 6: Delete Listing Without CSRF Token
echo "Test 6: Delete Listing Without CSRF Token (Happy Path)"
curl -s -X POST "${BASE_URL}/api/seller-dashboard/delete_listing.php" \
  -H "Content-Type: application/json" \
  --cookie-jar "${COOKIE_FILE}" --cookie "${COOKIE_FILE}" \
  -d '{"id":123}'
echo -e "\n"

# Test 7: Delete Listing With Invalid CSRF Token
echo "Test 7: Delete Listing With Invalid CSRF Token (Alternate Path)"
curl -s -X POST "${BASE_URL}/api/seller-dashboard/delete_listing.php" \
  -H "Content-Type: application/json" \
  --cookie-jar "${COOKIE_FILE}" --cookie "${COOKIE_FILE}" \
  -d '{"id":123,"csrf_token":"invalid"}'
echo -e "\n"

# Test 8: Set Item Status Without CSRF Token
echo "Test 8: Set Item Status Without CSRF Token (Happy Path)"
curl -s -X POST "${BASE_URL}/api/seller-dashboard/set_item_status.php" \
  -H "Content-Type: application/json" \
  --cookie-jar "${COOKIE_FILE}" --cookie "${COOKIE_FILE}" \
  -d '{"id":123,"status":"Active"}'
echo -e "\n"

# Test 9: Set Item Status With Invalid Status Value
echo "Test 9: Set Item Status With Invalid Status Value (Alternate Path)"
curl -s -X POST "${BASE_URL}/api/seller-dashboard/set_item_status.php" \
  -H "Content-Type: application/json" \
  --cookie-jar "${COOKIE_FILE}" --cookie "${COOKIE_FILE}" \
  -d '{"id":123,"status":"BadValue"}'
echo -e "\n"

# Test 10: Set Item Status With Invalid CSRF Token
echo "Test 10: Set Item Status With Invalid CSRF Token (Alternate Path)"
curl -s -X POST "${BASE_URL}/api/seller-dashboard/set_item_status.php" \
  -H "Content-Type: application/json" \
  --cookie-jar "${COOKIE_FILE}" --cookie "${COOKIE_FILE}" \
  -d '{"id":123,"status":"Active","csrf_token":"invalid"}'
echo -e "\n"

# Test 11: Create Chat Message Without CSRF Token
echo "Test 11: Create Chat Message Without CSRF Token (Happy Path)"
curl -s -X POST "${BASE_URL}/api/chat/create_message.php" \
  -H "Content-Type: application/json" \
  --cookie-jar "${COOKIE_FILE}" --cookie "${COOKIE_FILE}" \
  -d '{"receiver_id":"45","content":"Hello!"}'
echo -e "\n"

# Test 12: Create Chat Message With Invalid CSRF Token
echo "Test 12: Create Chat Message With Invalid CSRF Token (Alternate Path)"
curl -s -X POST "${BASE_URL}/api/chat/create_message.php" \
  -H "Content-Type: application/json" \
  --cookie-jar "${COOKIE_FILE}" --cookie "${COOKIE_FILE}" \
  -d '{"receiver_id":"45","content":"Hello!","csrf_token":"invalid"}'
echo -e "\n"

# Test 13: Update User Preferences Without CSRF Token
echo "Test 13: Update User Preferences Without CSRF Token (Happy Path)"
curl -s -X POST "${BASE_URL}/api/userPreferences.php" \
  -H "Content-Type: application/json" \
  --cookie-jar "${COOKIE_FILE}" --cookie "${COOKIE_FILE}" \
  -d '{"promoEmails":true,"revealContact":false,"interests":["Furniture","Books"],"theme":"dark"}'
echo -e "\n"

# Test 14: Update User Preferences With Invalid CSRF Token
echo "Test 14: Update User Preferences With Invalid CSRF Token (Alternate Path)"
curl -s -X POST "${BASE_URL}/api/userPreferences.php" \
  -H "Content-Type: application/json" \
  --cookie-jar "${COOKIE_FILE}" --cookie "${COOKIE_FILE}" \
  -d '{"promoEmails":true,"revealContact":false,"interests":["Furniture","Books"],"theme":"dark","csrf_token":"invalid"}'
echo -e "\n"

# Test 15: Manage Seller Listings Read-Only
echo "Test 15: Manage Seller Listings Read-Only (Happy Path)"
curl -s -X POST "${BASE_URL}/api/seller-dashboard/manage_seller_listings.php" \
  --cookie-jar "${COOKIE_FILE}" --cookie "${COOKIE_FILE}"
echo -e "\n"

# Test 16: Landing Listings Public Endpoint
echo "Test 16: Landing Listings Public Endpoint (Happy Path)"
curl -s -i -X GET "${BASE_URL}/api/landingListings.php"
echo -e "\n"

# Test 17: Image Fetch Public Endpoint
echo "Test 17: Image Fetch Public Endpoint (Happy Path)"
curl -s -i "${BASE_URL}/api/image.php?id=123"
echo -e "\n"

# Test 18: CORS Allowed Origin Browser Test (Manual)
echo "Test 18: CORS Allowed Origin Browser Test (Happy Path)"
echo "MANUAL TEST: From browser at ${BASE_URL}/ frontend, open console and invoke any API endpoint"
echo "Expected: No CORS errors in browser console"
echo -e "\n"

# Test 19: CORS Untrusted Origin Blocked (Manual)
echo "Test 19: CORS Untrusted Origin Blocked (Alternate Path)"
echo "MANUAL TEST: From unlisted origin, attempt fetch from API in browser"
echo "Expected: CORS failure; 403 or blocked by browser"
echo -e "\n"

# Test 20: Unauthenticated Access Rejected
echo "Test 20: Unauthenticated Access Rejected (Alternate Path)"
curl -s -X POST "${BASE_URL}/api/auth/change_password.php" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"old","newPassword":"N3w!Passw0rd!"}'
echo -e "\n"

# Test 21: Invalid JSON Body Rejected
echo "Test 21: Invalid JSON Body Rejected (Alternate Path)"
curl -s -X POST "${BASE_URL}/api/auth/change_password.php" \
  -H "Content-Type: application/json" \
  --cookie-jar "${COOKIE_FILE}" --cookie "${COOKIE_FILE}" \
  -d '{"currentPassword":"old","newPassword":"N3w!Passw0rd!"'
echo -e "\n"

echo "=== Test Suite Complete ==="





