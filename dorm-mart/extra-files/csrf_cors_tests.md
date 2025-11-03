Test 1: CSRF Token Endpoint
Objective: Obtain a CSRF token for optional use in POST requests
Steps:
1) curl -X GET "https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/api/auth/get-csrf-token.php"
Expected Result:
200 JSON: {"ok":true,"csrf_token":"<64-hex>"}

Test 2: Change Password (Happy)
Objective: Change password without CSRF token (backwards compatible)
Steps:
1) curl -X POST "https://aptitude.../api/auth/change_password.php" -H "Content-Type: application/json" --cookie-jar cookies.txt --cookie cookies.txt -d "{\"currentPassword\":\"old\",\"newPassword\":\"N3w!Passw0rd!\"}"
Expected Result:
200 {"ok":true}

Test 3: Change Password (Alternate - Invalid CSRF)
Objective: Reject when invalid CSRF token is provided
Steps:
1) Same as Test 2, but include "csrf_token":"invalid"
Expected Result:
403 {"ok":false,"error":"CSRF token validation failed"}

Test 4: Create Product Listing (Happy - FormData)
Objective: Create listing without CSRF token (backwards compatible)
Steps:
1) curl -X POST "https://aptitude.../api/seller-dashboard/product_listing.php" --cookie-jar cookies.txt --cookie cookies.txt -F "mode=create" -F "title=Desk" -F "price=50" -F "categories[]=Furniture" -F "itemLocation=North Campus" -F "condition=New"
Expected Result:
200 {"ok":true,...}

Test 5: Create Product Listing (Alternate - Invalid CSRF)
Objective: Reject when invalid CSRF token is provided
Steps:
1) Same as Test 4, plus -F "csrf_token=invalid"
Expected Result:
403 {"ok":false,"error":"CSRF token validation failed"}

Test 6: Delete Listing (Happy)
Objective: Delete a listing without CSRF token
Steps:
1) curl -X POST "https://aptitude.../api/seller-dashboard/delete_listing.php" -H "Content-Type: application/json" --cookie-jar cookies.txt --cookie cookies.txt -d "{\"id\":123}"
Expected Result:
200 {"success":true,"id":123}

Test 7: Delete Listing (Alternate - Invalid CSRF)
Objective: Reject when invalid CSRF token is provided
Steps:
1) Same as Test 6, include "csrf_token":"invalid"
Expected Result:
403 {"success":false,"error":"CSRF token validation failed"}

Test 8: Set Item Status (Happy)
Objective: Update item status without CSRF token
Steps:
1) curl -X POST "https://aptitude.../api/seller-dashboard/set_item_status.php" -H "Content-Type: application/json" --cookie-jar cookies.txt --cookie cookies.txt -d "{\"id\":123,\"status\":\"Active\"}"
Expected Result:
200 {"success":true,...}

Test 9: Set Item Status (Alternate - Invalid Value)
Objective: Reject invalid status values
Steps:
1) Same as Test 8 with "status":"BadValue"
Expected Result:
400 {"success":false,"error":"Invalid id or status"}

Test 10: Set Item Status (Alternate - Invalid CSRF)
Objective: Reject when invalid CSRF token is provided
Steps:
1) Same as Test 8 with "csrf_token":"invalid"
Expected Result:
403 {"success":false,"error":"CSRF token validation failed"}

Test 11: Create Chat Message (Happy)
Objective: Send a chat message without CSRF token
Steps:
1) curl -X POST "https://aptitude.../api/chat/create_message.php" -H "Content-Type: application/json" --cookie-jar cookies.txt --cookie cookies.txt -d "{\"receiver_id\":\"45\",\"content\":\"Hello!\"}"
Expected Result:
200 {"success":true,...}

Test 12: Create Chat Message (Alternate - Invalid CSRF)
Objective: Reject when invalid CSRF token is provided
Steps:
1) Same as Test 11 with "csrf_token":"invalid"
Expected Result:
403 {"success":false,"error":"CSRF token validation failed"}

Test 13: Update User Preferences (Happy)
Objective: Update preferences without CSRF token
Steps:
1) curl -X POST "https://aptitude.../api/userPreferences.php" -H "Content-Type: application/json" --cookie-jar cookies.txt --cookie cookies.txt -d "{\"promoEmails\":true,\"revealContact\":false,\"interests\":[\"Furniture\",\"Books\"],\"theme\":\"dark\"}"
Expected Result:
200 {"ok":true,...}

Test 14: Update User Preferences (Alternate - Invalid CSRF)
Objective: Reject when invalid CSRF token is provided
Steps:
1) Same as Test 13 with "csrf_token":"invalid"
Expected Result:
403 {"ok":false,"error":"CSRF token validation failed"}

Test 15: Manage Seller Listings (Happy - Read-only)
Objective: Fetch seller listings (no CSRF required)
Steps:
1) curl -X POST "https://aptitude.../api/seller-dashboard/manage_seller_listings.php" --cookie-jar cookies.txt --cookie cookies.txt
Expected Result:
200 {"success":true,"data":[...]}

Test 16: Landing Listings (Happy - Public)
Objective: Confirm public listings endpoint responds with security headers
Steps:
1) curl -i -X GET "https://aptitude.../api/landingListings.php"
Expected Result:
200 JSON list; security headers present

Test 17: Image Fetch (Happy - Public)
Objective: Confirm image endpoint responds with security headers
Steps:
1) curl -i "https://aptitude.../api/image.php?id=123"
Expected Result:
200 image; security headers present

Test 18: CORS Allowed Origin (Happy - Browser)
Objective: Verify allowed origin can call API
Steps:
1) From https://aptitude.cse.buffalo.edu/... frontend, invoke any API (e.g., landingListings)
Expected Result:
Success; no CORS errors in browser console

Test 19: CORS Untrusted Origin (Alternate - Browser)
Objective: Verify untrusted origins are blocked
Steps:
1) From an unlisted origin, attempt fetch to API
Expected Result:
CORS failure in browser; 403 or blocked by browser. Postman/cURL not affected

Test 20: Unauthenticated Access (Alternate)
Objective: Ensure auth-required endpoints reject unauthenticated requests
Steps:
1) POST to any auth-required endpoint without session cookie
Expected Result:
401/redirect-style error JSON

Test 21: Invalid JSON (Alternate)
Objective: Ensure endpoints validate JSON bodies
Steps:
1) POST malformed JSON to change_password/delete_listing/set_item_status/create_message/userPreferences
Expected Result:
400 {"ok":false,"error":"Invalid JSON body"}



