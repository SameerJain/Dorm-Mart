import { NavLink } from "react-router-dom";

const NAV_BLUE = "#2563EB"; // exact hex of your nav bar

function SettingsLayout({ children }) {
  const linkBase = "/app/setting";

  const links = [
    { label: "Personal Information", to: `${linkBase}/personal-information` },
    { label: "User Preferences", to: `${linkBase}/user-preferences` },
    { label: "Security Options", to: `${linkBase}/security-options` },
    { label: "Change Password", to: `${linkBase}/change-password` },
  ];

  return (
    // Fill viewport height minus the nav (≈64px). Use *height* + child h-full.
    <div className="w-full" style={{ height: "calc(100vh - 64px)" }}>
      {/* Full-width grid that also stretches to full height */}
      <div className="grid h-full w-full grid-cols-[280px_1fr] gap-6 px-6 py-6">
        {/* Sidebar (stretch to bottom) */}
        <aside
          className="h-full rounded-xl p-0 text-white shadow"
          style={{ backgroundColor: NAV_BLUE }}
        >
          <div className="px-4 py-3">
            <h2 className="text-xl font-serif font-semibold">Settings</h2>
          </div>
          <div className="h-px w-full" style={{ background: "rgba(255,255,255,0.25)" }} />
          <nav className="flex h-[calc(100%-56px-1px)] flex-col gap-1 overflow-auto p-2">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                    [
                    // was: "rounded-lg px-3 py-2 text-sm transition"
                    "rounded-lg px-3 py-2 text-base transition font-medium leading-6",
                    "hover:underline",
                    isActive ? "bg-white/15" : "bg-transparent",
                    ].join(" ")
                }
                style={({ isActive }) => ({
                    color: "#ffffff",
                    ...(isActive ? { boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)" } : {}),
            })}
                >
            {l.label}
            </NavLink>
            ))}
          </nav>
        </aside>

        {/* Content (stretch to bottom) */}
        <main className="h-full rounded-xl bg-white p-6 shadow overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default SettingsLayout;
