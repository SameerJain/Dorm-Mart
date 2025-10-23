# Frontend Documentation

## What This Is
A simple guide to all the frontend files in the src folder. Each file does one main thing.

---

## 📄 **Main Files**
The most important files that make the app work.

- **App.js** - Sets up all the pages and routes for the website.
- **index.js** - Starts the React app and puts it on the webpage.
- **index.css** - All the basic styling for the whole website.

---

## 📁 **assets/** - Images & Files
Pictures and documents used on the website.

### **icons/** - Small Pictures
- **icons8-chat-96.png** - Chat icon for messaging features.
- **icons8-filter-96.png** - Filter icon for search and sorting.
- **icons8-notification-96.png** - Bell icon for notifications.
- **icons8-search-96.png** - Magnifying glass for search.
- **icons8-setting-96.png** - Gear icon for settings.
- **icons8-user-icon-96.png** - Person icon for user accounts.
- **puppy.jpg** - Test picture.

### **images/** - Background Pictures
- **login-page-left-side-background.jpg** - Background for the login page.

### **pdfs/** - Documents
- **privacy.pdf** - Privacy policy document.
- **terms&conditions.pdf** - Terms and conditions document.

### **product-images/** - Product Pictures
- **keyboard.jpg** - Picture of a keyboard.
- **smallcarpet.png** - Picture of a carpet.
- **wireless-mouse.jpg** - Picture of a wireless mouse.

---

## 📁 **components/** - Reusable Parts
Small pieces that can be used on multiple pages.

- **ItemCard.js** - Old version of how to show product cards.
- **ItemCardNew.jsx** - New version of how to show product cards.

### **MainNav/** - Navigation Bar
- **Icon.jsx** - Makes icons that can be used anywhere.
- **MainNav.jsx** - The main navigation bar at the top of the website.

### **Products/** - Product Stuff
- **PurchasedItem.jsx** - Shows items that users bought.
- **YearSelect.jsx** - Dropdown to pick a year for filtering.

---

## 📁 **pages/** - Main Pages
The big pages that users see.

### **AccountCreation/** - Sign Up
- **index.jsx** - Page where new users create accounts.

- **ForgotPasswordPage.js** - Page where users request password reset emails.

### **HomePage/** - Main Page
- **LandingPage.jsx** - The main homepage with featured products.

- **LoginPage.js** - Page where users enter username and password.

### **ProductListing/** - Seller Tools
- **ProductListingPage.jsx** - Page where sellers add and edit their products.

### **PurchaseHistory/** - Shopping History
- **ItemDetailPage.js** - Shows details of one purchased item.
- **PurchaseHistoryLayout.js** - Wrapper for all purchase history pages.
- **PurchaseHistoryPage.js** - Shows list of all items a user bought.

### **ResetPassword/** - Password Reset
- **ForgotPasswordConfirmation.jsx** - Page shown after requesting password reset.
- **ResetPasswordConfirmation.jsx** - Page shown after successfully resetting password.
- **ResetPasswordError.jsx** - Error page when reset links don't work.
- **ResetPasswordForm.jsx** - Form where users enter their new password.

### **SellerDashboard/** - Seller Tools
- **SellerDashboardPage.jsx** - Main page for sellers to manage their listings.

### **Settings/** - User Settings
- **ChangePassword.jsx** - Page where users change their password.
- **SettingsLayout.jsx** - Wrapper for all settings pages.
- **UserPreferences.jsx** - Page where users set their interests and preferences.

- **RootLayout.js** - Main layout for all pages after login.

---

## 📁 **utils/** - Helper Functions
Small functions that help other files work.

- **auth.js** - Helper functions for login and user sessions.

---

## 🎨 **How The Website Works**

- **Pages**: Each page does one main thing (login, signup, etc.)
- **Components**: Small reusable pieces used on multiple pages
- **Assets**: Pictures and files used throughout the website
- **Utils**: Helper functions that make things work

---

## 🔧 **Main Features**

- **Login System**: Users can login, logout, and reset passwords
- **Product Management**: Sellers can add and manage their products
- **Purchase History**: Users can see what they bought
- **Settings**: Users can change their preferences and password
- **Security**: Password protection and rate limiting

---

*Last Updated: October 2024*
