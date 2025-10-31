import { Outlet } from "react-router-dom";
import MainNav from "../components/MainNav/MainNav";

// once user logs in, load websocket
function RootLayout() {

  return (
    <>
      <MainNav />
      <Outlet />
    </>
  );
}

export default RootLayout;
