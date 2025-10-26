import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import MainNav from "../components/MainNav/MainNav";

function RootLayout() {
  const navigate = useNavigate();

  useEffect(() => {
    // Do not do client-side auth checks; rely on server on each protected API call
  }, [navigate]);

  return (
    <>
      <MainNav />
      <Outlet />
    </>
  );
}

export default RootLayout;
