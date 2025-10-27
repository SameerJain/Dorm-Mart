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
import ProductListingPage from "./pages/ItemForms/ProductListingPage.jsx";
import CreateAccount from "./pages/AccountCreation/index.jsx";
import ChangePasswordPage from "./pages/Settings/ChangePassword.jsx";
import UserPreferences from "./pages/Settings/UserPreferences.jsx";
import ItemDetailPage from "./pages/PurchaseHistory/ItemDetailPage.js"
import SellerDashboardPage from "./pages/SellerDashboard/SellerDashboardPage.jsx";
// Chat context
import { ChatProvider } from "./context/ChatContext.js";
import ChatPage from "./pages/Chat/Chat.jsx";

// Load user theme immediately when app starts
const loadUserTheme = async () => {
  // First clear any existing theme to prevent cross-user contamination
  document.documentElement.classList.remove('dark');
  
  // Get user ID for user-specific localStorage
  let userId = null;
  try {
    const API_BASE = process.env.REACT_APP_API_BASE || "/api";
    const meRes = await fetch(`${API_BASE}/auth/me.php`, { 
      method: 'GET', 
      credentials: 'include' 
    });
    if (meRes.ok) {
      const meJson = await meRes.json();
      userId = meJson.user_id;
    }
  } catch (e) {
    // User not authenticated
  }

  // Try localStorage first for immediate application
  if (userId) {
    const userThemeKey = `userTheme_${userId}`;
    const localTheme = localStorage.getItem(userThemeKey);
    if (localTheme) {
      if (localTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }

  // Then get from backend and override localStorage
  try {
    const API_BASE = process.env.REACT_APP_API_BASE || "/api";
    const res = await fetch(`${API_BASE}/userPreferences.php`, { 
      method: 'GET', 
      credentials: 'include' 
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.ok && json?.data?.theme) {
        // Apply theme from backend
        if (json.data.theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        // Update localStorage with backend value
        if (userId) {
          const userThemeKey = `userTheme_${userId}`;
          localStorage.setItem(userThemeKey, json.data.theme);
        }
      }
    }
  } catch (e) {
    // User not authenticated or error - default to light theme
    document.documentElement.classList.remove('dark');
  }
};

// Load theme immediately
loadUserTheme();

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
    element: (
    <ChatProvider>
      <RootLayout />
    </ChatProvider>
  ),
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
      {
        path: "chat",
        children: [
          { index: true, element: < ChatPage/>}
        ]
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
