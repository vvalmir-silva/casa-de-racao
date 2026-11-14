import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["'Manrope Variable'", "system-ui", "sans-serif"] },
      colors: {
        // Paleta "varejo": azul-petróleo (pine = cor principal) + tangerina (kibble = destaque/ofertas)
        ink: { DEFAULT: "#14202A", 2: "#3B4955", 3: "#66727D", 4: "#98A2AB" },
        line: { DEFAULT: "#E2E6EA", 2: "#CBD2D9" },
        page: "#F4F6F8",
        pine: { 50: "#E8F3F7", 100: "#CFE6EF", 200: "#9FCCDD", 500: "#1C7A9C", 600: "#136481", 700: "#0D4F68", 800: "#093D51", 900: "#062B3A" },
        kibble: { 50: "#FFF3E8", 100: "#FFE2C7", 400: "#FF9A45", 500: "#FF7A1A", 600: "#E5640A" },
        oferta: { DEFAULT: "#E0262F", 50: "#FDECEC" },
        // compatibilidade com classes antigas
        brand: { 50: "#E8F3F7", 100: "#CFE6EF", 500: "#1C7A9C", 600: "#136481", 700: "#0D4F68", 900: "#062B3A" },
      },
      borderRadius: { xl: "14px", "2xl": "20px", "3xl": "28px" },
      boxShadow: { card: "0 1px 2px rgba(20,32,42,.04), 0 8px 24px -16px rgba(20,32,42,.18)", pop: "0 12px 40px -12px rgba(6,43,58,.35)" },
    },
  },
  plugins: [],
} satisfies Config;
