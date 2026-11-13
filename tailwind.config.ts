import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["'Manrope Variable'", "system-ui", "sans-serif"] },
      colors: {
        ink: { DEFAULT: "#17201C", 2: "#3E4A44", 3: "#6B736E", 4: "#9AA19C" },
        line: { DEFAULT: "#E3E6E1", 2: "#CFD4CE" },
        page: "#F3F4F1",
        pine: { 50: "#EAF3EF", 100: "#D3E6DD", 200: "#A9CDBC", 500: "#2F7A62", 600: "#23634F", 700: "#1B4D3E", 800: "#143A2F", 900: "#0E2A22" },
        kibble: { 50: "#FFF6E5", 100: "#FDEAC3", 400: "#F1B655", 500: "#E8A33D", 600: "#C9862A" },
        // compatibilidade com classes antigas
        brand: { 50: "#EAF3EF", 100: "#D3E6DD", 500: "#2F7A62", 600: "#23634F", 700: "#1B4D3E", 900: "#0E2A22" },
      },
      borderRadius: { xl: "14px", "2xl": "20px", "3xl": "28px" },
      boxShadow: { card: "0 1px 2px rgba(23,32,28,.04), 0 8px 24px -16px rgba(23,32,28,.18)", pop: "0 12px 40px -12px rgba(14,42,34,.35)" },
    },
  },
  plugins: [],
} satisfies Config;
