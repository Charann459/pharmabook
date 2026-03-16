// packages/mobile/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  // THIS IS THE LINE THE ERROR IS COMPLAINING ABOUT:
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
}