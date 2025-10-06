import { createHashRouter, RouterProvider } from "react-router-dom";
import RootLayout from "./pages/RootLayout";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import PurchaseHistoryPage from "./pages/PurchaseHistory/PurchaseHistoryPage";
import PurchaseHistoryLayout from "./pages/PurchaseHistory/PurchaseHistoryLayout";
import ProductListingPage from "./pages/ProductListing/ProductListingPage";


/* hashRouter adds # in front of each url path
 Request: https://example.com/#/app/purchase-history.
 Server only sees https://example.com/ and serves index.html.
 The part after # (/app/purchase-history) is handled by JS routing in client-side */

export const router = createHashRouter([
  // Login is the default route
  {
    path: "/",
    element: <LoginPage />,
  },
  // Main application lives under /app
  {
    path: "/app",
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
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
        ],
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
