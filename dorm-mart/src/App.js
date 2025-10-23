// dorm-mart/src/App.js
import { createHashRouter, RouterProvider, Navigate } from "react-router-dom";
import RootLayout from "./pages/RootLayout";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/HomePage/LandingPage";
import ForgotPasswordPage from './pages/ForgotPasswordPage.js';
import ResetPasswordConfirmation from './pages/ResetPassword/ResetPasswordConfirmation.jsx';
import ForgotPasswordConfirmation from './pages/ResetPassword/ForgotPasswordConfirmation.jsx';
import ResetPasswordForm from './pages/ResetPassword/ResetPasswordForm.jsx';
import PurchaseHistoryPage from "./pages/PurchaseHistory/PurchaseHistoryPage";
import PurchaseHistoryLayout from "./pages/PurchaseHistory/PurchaseHistoryLayout";
import ProductListingPage from "./pages/ProductListing/ProductListingPage.jsx";
import CreateAccount from "./pages/AccountCreation/index.jsx";
import ChangePasswordPage from "./pages/Settings/ChangePassword.jsx";
import UserPreferences from "./pages/Settings/UserPreferences.jsx";
import ItemDetailPage from "./pages/PurchaseHistory/ItemDetailPage.js"
import SellerDashboardPage from "./pages/SellerDashboard/SellerDashboardPage.jsx";

export const router = createHashRouter([
  // redirect default hash `#/` to `#/login`
  { path: "/", element: <Navigate to="/login" replace /> },

  // Auth
  { path: "/login", element: <LoginPage /> },
  { path: "/create-account", element: <CreateAccount /> },
  { path:"/forgot-password", element: <ForgotPasswordPage />},
  { path:"/forgot-password/confirmation", element: <ForgotPasswordConfirmation />},
  { path: "/reset-password", element: <ResetPasswordForm /> },
  { path: "/reset-password/confirmation", element: <ResetPasswordConfirmation /> },
  // Main app
  {
    path: "/app",
    element: <RootLayout />,
    children: [

  { index: true, element: <LandingPage /> },

      // Product Listing
      {
        path: "product-listing",
        children: [
          { index: true, element: <ProductListingPage /> },
          { path: "new", element: <ProductListingPage key="new" /> },
          { path: "edit/:id", element: <ProductListingPage key="edit" /> },
        ],
      },
      {
        path: "purchase-history",
        element: <PurchaseHistoryLayout />,
        children: [
          { index: true, element: <PurchaseHistoryPage /> },
          { path: "item-detail/:id", element: <ItemDetailPage /> },
        ],
      },

      // Seller Dashboard
      {
        path: "seller-dashboard",
        element: <SellerDashboardPage />,
      },

      // Settings (under /app)
      {
        path: "setting",
        children: [
          { index: true, element: <Navigate to="/app/setting/change-password" replace /> },
          { path: "change-password", element: <ChangePasswordPage /> },

          // User Preferences
          { path: "user-preferences", element: <UserPreferences /> },

          // Stubs for yet-to-be-implemented pages (intentionally 404)
          {
            path: "personal-information",
            loader: () => {
              throw new Response("Not Found", { status: 404 });
            },
          },
          {
            path: "security-options",
            loader: () => {
              throw new Response("Not Found", { status: 404 });
            },
          },
        ],
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
