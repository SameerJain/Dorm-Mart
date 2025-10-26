# Backend API Documentation

## What This Is
A simple guide to all the backend files in the API folder. Each file does one main thing.

---

## 📁 **auth/** - User Login & Security
Files that handle user accounts and passwords.

- **auth_handle.php** - Handles user login requests and checks if passwords are correct.
- **change_password.php** - Lets logged-in users change their password safely.
- **create_account.php** - Creates new user accounts when people sign up.
- **forgot-password.php** - Sends password reset emails to users who forgot their password.
- **login.php** - Main login page that checks username/password and blocks bad attempts.
- **logout.php** - Logs users out and clears their session.
- **validate-reset-token.php** - Checks if password reset links are valid and not expired.

---

## 📁 **database/** - Database Stuff
Files that connect to and manage the database.

- **db_connect.php** - Connects to the MySQL database. Used by all other files.
- **migrate_data.php** - Moves data from old database to new database safely.
- **migrate_schema.php** - Updates database tables when we make changes.

---

## 📁 **purchase-history/** - Shopping History
Files that handle what users bought.

- **fetch-transacted-items.php** - Gets a list of all items a user has purchased.

---

## 📁 **redirects/** - Page Redirects
Files that send users to the right pages.

- **handle_password_reset_token_redirect.php** - When users click password reset links in emails, this sends them to the right page.
- **show_password_reset_link_expired_page.php** - Shows an error page when reset links don't work.

---

## 📁 **security/** - Safety Features
Files that keep the site secure.

- **security.php** - Main security file that blocks too many login attempts and handles CORS.

---

## 📁 **seller-dashboard/** - Seller Tools
Files for people who sell items.

- **manage_seller_listings.php** - Lets sellers add, edit, or delete their product listings.

---

## 📁 **utility/** - Admin Tools
Files that help administrators manage the site.

- **hash_password.php** - Converts passwords into secure codes for storage.
- **manage_forgot_password_rate_limiting.php** - Admin tool to reset the 10-minute email limit.
- **monitor_user_attempts.php** - Shows admins who tried to login and failed.
- **rate_limit_dashboard.php** - Admin dashboard showing security stats.
- **reset_user_account_lockouts.php** - Admin tool to unlock blocked user accounts.

---

## 📁 **api-test-files/** - Test Data
Files used for testing the system.

### **chris/** - Chris's Test Files
- **items-with-year.php** - Creates fake purchase data with different years.
- **multiple-purchased-items.php** - Creates fake data for users who bought many items.
- **no-purchased-item.php** - Creates fake data for users who bought nothing.
- **one-purchased-item.php** - Creates fake data for users who bought one item.

### **sameer/** - Sameer's Test Files
- **invalid-email.php** - Tests what happens with bad email addresses.
- **valid-email.php** - Tests what happens with good email addresses.

---

## 📄 **Other Files**

- **landingListings.php** - Gets the main page product listings.
- **userPreferences.php** - Handles user settings like interests and notifications.

---

## 🔒 **How Security Works**

- **Rate Limiting**: Stops people from trying too many passwords too fast
- **Password Reset**: Secure links that expire and can only be used once
- **CORS**: Allows the frontend to talk to the backend safely
- **Password Hashing**: Passwords are stored as codes, not plain text

---

## 🛠 **Admin Tools**

- **Rate Limit Management**: Tools to reset security limits
- **User Lockout Control**: Tools to unlock blocked accounts
- **Database Migration**: Tools to update the database safely
- **Testing**: Tools to create fake data for testing

---

*Last Updated: October 2024*
