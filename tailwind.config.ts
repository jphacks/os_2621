import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        warmth: {
          50: "#fffaf5",
          100: "#fdf3e7",
          200: "#fae3c6",
          300: "#f4cca0",
          400: "#ecad73",
          500: "#de8c4a",
          600: "#c26d36",
          700: "#9e532b",
          800: "#7f4326",
          900: "#673922",
        },
        sage: {
          50: "#f5f7f5",
          100: "#e4ece4",
          200: "#c9d9c9",
          300: "#a4bea4",
          400: "#7d9f7d",
          500: "#608260",
          600: "#4b684b",
          700: "#3c523c",
          800: "#334333",
          900: "#2c382c",
        },
      },
      boxShadow: {
        hidamari: "0 4px 20px -2px rgba(180, 110, 50, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)",
        "hidamari-glow": "0 0 25px 2px rgba(235, 160, 90, 0.22)",
        "hidamari-soft": "0 2px 10px rgba(180, 110, 50, 0.06)",
      },
      keyframes: {
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.85" },
          "50%": { transform: "scale(1.05)", opacity: "1" },
        },
        "breathe-pulse": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        breathe: "breathe 4s ease-in-out infinite",
        "breathe-pulse": "breathe-pulse 4s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
