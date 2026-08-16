/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sand: {
          50: "#F6F1E7",
          100: "#EFE7D6",
          200: "#E1D3B4",
        },
        stone: {
          800: "#332C24",
          900: "#241F1A",
        },
        signal: {
          DEFAULT: "#17344B",
          light: "#274A63",
          dark: "#0F2436",
        },
        potentiel: {
          eleve: "#2E7D6B",
          modere: "#C99A3D",
          faible: "#C97A2B",
          defavorable: "#A33B2B",
          insuffisant: "#9C948A",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
