import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
  ],
  theme: {
    container: { center: true, padding: "1rem" },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        brand: {
          DEFAULT: "#5D34FF",
          light: "#7B52C7",
          dark: "#4A29CC",
          soft: "#EDE9FF",
          foreground: "#FFFFFF",
        },
        ink: {
          DEFAULT: "hsl(var(--ink))",
          soft: "hsl(var(--ink-soft))",
        },
        hairline: "hsl(var(--hairline))",
        good: "hsl(var(--good))",
        accent: "hsl(var(--accent))",
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      backgroundImage: {
        "brand-radial": "radial-gradient(ellipse at top, color-mix(in srgb, #5D34FF 15%, transparent), transparent 60%)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
