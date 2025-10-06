// dorm-mart/src/App.js
import { createHashRouter, RouterProvider, Navigate } from "react-router-dom";
import RootLayout from "./pages/RootLayout";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import PurchaseHistoryPage from "./pages/PurchaseHistory/PurchaseHistoryPage";
import PurchaseHistoryLayout from "./pages/PurchaseHistory/PurchaseHistoryLayout";
import ProductListingPage from "./pages/ProductListing/ProductListingPage.jsx";
import CreateAccount from "./pages/AccountCreation/index.jsx";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import ChangePasswordPage from "./pages/Settings/ChangePassword.jsx";

export const router = createHashRouter([
  // redirect default hash `#/` to `#/login`
  { path: "/", element: <Navigate to="/login" replace /> },

  // Auth
  { path: "/login", element: <LoginPage /> },
  { path: "/create-account", element: <CreateAccount /> },

  // Main app
  {
    path: "/app",
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },

      // Product Listing
      {
        path: "product-listing",
        children: [
          { index: true, element: <ProductListingPage /> },
          { path: "new", element: <ProductListingPage key="new" /> },
          { path: "edit/:id", element: <ProductListingPage key="edit" /> },
        ],
      },

      // Purchase History
      {
        path: "purchase-history",
        element: <PurchaseHistoryLayout />,
        children: [
          { index: true, element: <PurchaseHistoryPage /> },
          { path: "item-detail/:id", element: <ItemDetailPage /> },
        ],
      },

      // Settings (under /app)
      {
        path: "setting",
        children: [
          { index: true, element: <Navigate to="/app/setting/change-password" replace /> },
          { path: "change-password", element: <ChangePasswordPage /> },

          // Stubs for yet-to-be-implemented pages (intentionally 404)
          {
            path: "personal-information",
            loader: () => {
              throw new Response("Not Found", { status: 404 });
            },
          },
          {
            path: "user-preferences",
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
