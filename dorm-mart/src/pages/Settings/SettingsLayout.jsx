import { NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { logout } from "../../utils/handleAuth";

function SettingsLayout({ children }) {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const navigate = useNavigate();
  const linkBase = "/app/setting";

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (showMobileMenu) {
      const scrollY = window.scrollY;
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
    } else {
      const scrollY = document.body.style.top;
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || "0") * -1);
      }
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
    };
  }, [showMobileMenu]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const links = [
    { label: "My Profile", to: `${linkBase}/my-profile` },
    { label: "User Preferences", to: `${linkBase}/user-preferences` },
    { label: "Change Password", to: `${linkBase}/change-password` },
  ];

  return (
    // Back to normal: no `relative`, still using the height minus nav
    <div
      className="w-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden"
      style={{ height: "calc(100vh - 64px)" }}
    >
      {/* Mobile hamburger menu button - only visible on mobile */}
      <div className="lg:hidden p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
          <span className="text-lg font-medium">Settings</span>
        </button>
      </div>

      {/* Full-width grid that also stretches to full height */}
      <div className="grid flex-1 w-full grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 px-6 pt-6 pb-8 min-h-0">
        {/* Desktop Sidebar (hidden on mobile) */}
        <aside className="hidden h-full rounded-xl p-0 text-white shadow bg-blue-600 dark:bg-blue-800 dark:shadow-lg dark:shadow-black/25 dark:ring-1 dark:ring-white/10 lg:block">
          <div className="px-4 py-3">
            <h2 className="text-xl font-serif font-semibold">Settings</h2>
          </div>
          <div
            className="h-px w-full"
            style={{ background: "rgba(255,255,255,0.25)" }}
          />
          <nav className="flex h-[calc(100%-56px-1px)] flex-col gap-1 overflow-auto p-2">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  [
                    "rounded-lg px-3 py-2 text-base font-medium leading-6 text-white transition",
                    "hover:underline hover:bg-white/10 dark:hover:bg-white/10",
                    isActive
                      ? "bg-white/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)] dark:bg-white/10 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]"
                      : "bg-transparent",
                  ].join(" ")
                }
              >
                {l.label}
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              className="mt-1 rounded-lg border border-white/50 px-3 py-2 text-base font-medium leading-6 text-white transition hover:border-white/75 hover:bg-white/20 active:bg-white/30 dark:border-white/35 dark:hover:border-white/55 dark:hover:bg-white/15"
            >
              Log Out
            </button>
          </nav>
        </aside>

        {/* Mobile Sidebar Overlay – now FIXED so it covers nav bar too */}
        <div
          className={`lg:hidden fixed inset-0 z-40 flex transition-opacity duration-300 ${
            showMobileMenu
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowMobileMenu(false)}
          ></div>

          {/* Sliding sidebar */}
          <aside
            className={`relative h-full w-64 transform rounded-r-xl bg-blue-600 p-0 text-white shadow-lg transition-transform duration-300 dark:bg-blue-800 dark:shadow-black/40 dark:ring-1 dark:ring-white/10 ${
              showMobileMenu ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-xl font-serif font-semibold">Settings</h2>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="text-white hover:text-gray-300"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div
              className="h-px w-full"
              style={{ background: "rgba(255,255,255,0.25)" }}
            />
            <nav className="flex h-[calc(100%-56px-1px)] flex-col gap-1 overflow-auto p-2">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  onClick={() => setShowMobileMenu(false)}
                  className={({ isActive }) =>
                    [
                      "rounded-lg px-3 py-2 text-base font-medium leading-6 text-white transition",
                      "hover:underline hover:bg-white/10 dark:hover:bg-white/10",
                      isActive
                        ? "bg-white/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)] dark:bg-white/10 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]"
                        : "bg-transparent",
                    ].join(" ")
                  }
                >
                  {l.label}
                </NavLink>
              ))}
              <button
                onClick={() => {
                  handleLogout();
                  setShowMobileMenu(false);
                }}
                className="mt-1 rounded-lg border border-white/50 px-3 py-2 text-base font-medium leading-6 text-white transition hover:border-white/75 hover:bg-white/20 active:bg-white/30 dark:border-white/35 dark:hover:border-white/55 dark:hover:bg-white/15"
              >
                Log Out
              </button>
            </nav>
          </aside>
        </div>

        {/* Content (stretch to bottom) */}
        <main
          className="h-full rounded-xl bg-white dark:bg-gray-800 p-4 sm:p-6 pb-10 sm:pb-12 shadow overflow-auto min-h-0"
          style={{
            overscrollBehaviorY: "contain",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default SettingsLayout;
