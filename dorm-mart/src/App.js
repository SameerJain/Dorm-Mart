import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import RootLayout from './pages/RootLayout';
import ItemDetailPage from './pages/PurchaseHistory/ItemDetailPage';
import PurchaseHistoryPage from './pages/PurchaseHistory/PurchaseHistoryPage';
import PurchaseHistoryLayout from './pages/PurchaseHistory/PurchaseHistoryLayout';
import CreateAccount from './pages/AccountCreation/index.jsx'

export const router = createBrowserRouter([
  {
    path:"/create-account",
    element: <CreateAccount />,
  },
]);

function App() {
  return <RouterProvider router={router} />
}


export default App;