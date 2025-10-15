/** @type {import('tailwindcss').Config} */
export default {
  content: ["./public/index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sirin: ['"Sirin Stencil"', "serif"],
        tai: ['"Tai Heritage Pro"', "serif"],
        taprom: ["Taprom", "cursive"],
      },
    },
  },
  plugins: [],
};
