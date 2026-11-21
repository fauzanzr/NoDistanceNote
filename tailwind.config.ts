import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

// Palet ala Notion: terang hangat & dark mode matte (#191919).
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: "#2383e2", dark: "#1b74cc" },
        zinc: {
          50: "#f7f7f5",
          100: "#efeeec",
          200: "#e6e5e3",
          300: "#d3d1cb",
          400: "#9b9a97",
          500: "#787774",
          600: "#5f5e5b",
          700: "#373737",
          800: "#2f2f2f",
          900: "#252525",
          950: "#191919",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "-apple-system", "BlinkMacSystemFont", "Segoe UI Variable Display", "Segoe UI", "Helvetica", "Apple Color Emoji", "Arial", "sans-serif", "Segoe UI Emoji", "Segoe UI Symbol"],
        mono: ["SFMono-Regular", "Menlo", "Consolas", "PT Mono", "Liberation Mono", "Courier", "monospace"],
      },
      borderRadius: { lg: "6px", xl: "8px", "2xl": "12px" },
    },
  },
  plugins: [typography],
};
export default config;
