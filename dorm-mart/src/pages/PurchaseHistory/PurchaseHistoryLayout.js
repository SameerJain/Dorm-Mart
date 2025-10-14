// PurchaseHistoryLayout.jsx
import { Outlet } from "react-router-dom";

export default function PurchaseHistoryLayout() {
  return (
    <div className="px-3 sm:px-6 lg:px-10 py-6 max-w-[90rem] mx-auto">
      <Outlet />
    </div>
  );
}

