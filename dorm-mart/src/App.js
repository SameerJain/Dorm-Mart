import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import RootLayout from './pages/RootLayout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ItemDetailPage from './pages/PurchaseHistory/ItemDetailPage';
import PurchaseHistoryPage from './pages/PurchaseHistory/PurchaseHistoryPage';
import PurchaseHistoryLayout from './pages/PurchaseHistory/PurchaseHistoryLayout';
import CreateAccount from './pages/AccountCreation/index.jsx'

export const router = createBrowserRouter([
  // Login is the default route
  {
    path: "/",
    element: <LoginPage />,
  },
  {
    path:"/create-account",
    element: <CreateAccount />,
  },
  // Main application lives under /app
  {
    path: "/app",
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: "purchase-history",
        element: <PurchaseHistoryLayout />,
        children: [
          { index: true, element: <PurchaseHistoryPage /> },
          { path: "item-detail/:id", element: <ItemDetailPage /> },
        ],
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />
}


export default App;