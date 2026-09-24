import plugin from "tailwindcss/plugin";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./public/index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  // Scope hover: styles to real hover devices so a tap on a phone or tablet
  // doesn't leave a button stuck in its hover color.
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      fontFamily: {
        sirin: ['"Sirin Stencil"', "serif"],
        tai: ['"Tai Heritage Pro"', "serif"],
        taprom: ["Taprom", "cursive"],
      },
    },
  },
  plugins: [
    // Registered as variants rather than `raw` screens, which would disable
    // Tailwind's built-in max-* breakpoint variants.
    plugin(({ addVariant }) => {
      // Finger-sized pointer (phones, tablets, touch-first laptops).
      addVariant("coarse", "@media (pointer: coarse)");
      // Real hover + precise pointer; use to hide hover-reveal controls
      // only where hovering is possible.
      addVariant("mouse", "@media (hover: hover) and (pointer: fine)");
      // Phones in landscape and other very short viewports.
      addVariant("short", "@media (max-height: 500px)");
    }),
  ],
};
