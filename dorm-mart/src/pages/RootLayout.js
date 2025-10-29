import { useEffect } from "react";
import { ensureSocket } from "../server/ws-demo"
import { Outlet } from "react-router-dom";
import MainNav from "../components/MainNav/MainNav";

// once user logs in, load websocket
function RootLayout() {
  useEffect(() => {
    ensureSocket();
  }, []);

  return (
    <>
      <MainNav />
      <Outlet />
    </>
  );
}

export default RootLayout;
