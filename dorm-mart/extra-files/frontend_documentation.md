# Frontend Documentation

## What This Is

This is a quick map of the current React `src/` tree. React page/component files use `PascalCase.jsx`; hooks and utilities use `camelCase.js`.

## Main files

- `App.jsx` - Defines app routes and route-level page composition.
- `index.js` - Mounts the React app.
- `index.css` - Global styles and shared utility classes.

## components/

Reusable UI pieces used across pages.

- `DetailRow.jsx`, `PageBackButton.jsx`, `ProfileLink.jsx` - Shared small UI components.
- `ItemCardNew.jsx`, `Products/PurchasedItem.jsx` - Listing and purchased-item cards.
- `PreLoginBranding.jsx`, `PreLoginNavLinks.jsx` - Shared pre-login layout pieces.
- `forms/PasswordRequirementRow.jsx` - Password policy display row.
- `MainNav/` - Main app navigation and icon wrapper.

## context/, hooks/, constants/, utils/

Shared frontend logic.

- `context/ChatContext.jsx`, `context/chatContextUtils.js` - Chat state provider and API helpers.
- `hooks/useTheme.js`, `hooks/useEmailPolicy.js` - Shared app hooks.
- `constants/meetLocations.js` - Scheduled purchase meet-location constants.
- `utils/apiConfig.js` - `PUBLIC_URL` and `REACT_APP_API_BASE` helpers.
- `utils/formatters.js`, `utils/productDetails.js`, `utils/imageFallback.js` - Display, product, and media helpers.
- `utils/handleAuth.js`, `utils/loadTheme.js` - Auth and theme helpers.
- `utils/inputValidation.js`, `utils/passwordPolicy.js`, `utils/priceValidation.js`, `utils/numericInputKeyHandlers.js` - Form validation helpers.

## pages/

Top-level user-facing page areas.

- `AccountCreation/AccountCreationPage.jsx` - Create account flow.
- `ForgotPasswordPage.jsx`, `ResetPassword/` - Forgot/reset password flow.
- `LoginPage.jsx`, `WelcomePage.jsx` - Pre-login entry pages.
- `RootLayout.jsx` - Main authenticated app shell.
- `Home/LandingPage.jsx` - Authenticated landing page.
- `Search/SearchResultsPage.jsx` - Listing search and filters.
- `ItemForms/ProductListingPage.jsx` - Create/edit listings.
- `ItemDetails/` - Product and receipt detail pages with local `components/`, `hooks/`, and `utils/`.
- `Chat/` - Conversation UI, message cards, scheduling/confirmation/review prompt cards, and local chat utilities.
- `SellerDashboard/` - Seller listing dashboard and buyer-rating modal.
- `ScheduledPurchases/` - Schedule, confirm, ongoing, completed, and report-issue pages.
- `PurchaseHistory/` - Purchase history layout, list, and detail page.
- `Wishlist/WishlistPage.jsx`, `Notification/NotificationPage.jsx` - Wishlist and notification views.
- `Settings/` - Profile, password, preferences, and buyer reviews.
- `PublicProfile/PublicProfilePage.jsx` - Public user profile.
- `Reviews/` - Review modal, star rating, and review image gallery.
- `FAQ/` - FAQ page and modal sections.

## assets/

Static images used by the app and README screenshots.

- `icons/` - Navigation and UI icon images.
- `images/` - General image assets.
- `product-images/` - Sample product images.
- `readme-images/` - Documentation screenshots.

## Routing Notes

- User-facing React routes intentionally keep existing kebab/camel route paths such as `/app/seller-dashboard`, `/app/purchase-history`, and `/app/viewProduct/:id`.
- Backend API endpoint URLs use snake_case paths such as `/api/seller_dashboard/product_listing.php`.
- Build base paths come from `PUBLIC_URL` in the target environment file or platform environment, not from hardcoded package scripts.

*Last updated: environment-backed frontend build configuration.*
