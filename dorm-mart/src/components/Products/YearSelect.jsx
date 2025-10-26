import { useEffect, useRef, useState } from "react";

export default function YearSelect({ years, value, onChange }) {
  const [open, setOpen] = useState(false);           // menu open state
  const btnRef = useRef(null);                       // trigger button ref
  const popRef = useRef(null);                       // popup menu ref

  // Close on outside click
  useEffect(() => {
    function onDocClick(e) {
      if (!open) return;
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        popRef.current && !popRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Basic keyboard support
  function onKeyDown(e) {
    if (e.key === "Escape") setOpen(false);
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      setOpen((o) => !o);
    }
  }

  return (
    <div className="relative w-full sm:max-w-md">
      {/* Slightly smaller label on mobile */}
      <label
        htmlFor="yearSelectButton"
        className="block mb-2 text-base sm:text-base font-medium text-gray-700"
      >
        Select year
      </label>

      {/* Trigger: comfortable tap height (48px), toned-down text on mobile */}
      <button
        id="yearSelectButton"
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className="
          w-full rounded-lg px-4 h-12
          text-xl sm:text-lg font-medium
          bg-gray-200 text-gray-900
          focus:outline-none focus:ring-2 focus:ring-blue-700
          flex items-center justify-between
        "
      >
        <span>{value}</span>
        <svg
          className={`w-5 h-5 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
        >
          <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.17l3.71-2.94a.75.75 0 1 1 .94 1.16l-4.24 3.36a.75.75 0 0 1-.94 0L5.21 8.39a.75.75 0 0 1 .02-1.18z" />
        </svg>
      </button>

      {/* Popup menu: item text reduced to text-xl on phones, base padding tightened */}
      {open && (
        <ul
          ref={popRef}
          role="listbox"
          tabIndex={-1}
          className="
            absolute z-50 mt-2 w-full
            max-h-64 overflow-auto
            rounded-xl border border-gray-300
            bg-white shadow-lg
            focus:outline-none
          "
        >
          {years.map((y) => {
            const selected = y === value;
            return (
              <li key={y}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(y);
                    setOpen(false);
                    requestAnimationFrame(() => btnRef.current?.focus());
                  }}
                  className={`
                    w-full text-left
                    px-4 py-2.5
                    text-xl sm:text-base
                    ${selected ? "bg-blue-50 text-blue-700" : "text-gray-900"}
                    hover:bg-gray-100
                    focus:outline-none
                  `}
                >
                  {y}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
