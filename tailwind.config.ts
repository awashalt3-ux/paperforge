import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1440px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: "hsl(var(--sidebar))",
        canvas: "hsl(var(--canvas))",
        forge: {
          50: "#eef7f4",
          100: "#d6ece5",
          200: "#add8cc",
          300: "#7ebcab",
          400: "#529a88",
          500: "#397e6e",
          600: "#2b6559",
          700: "#265249",
          800: "#21433c",
          900: "#1e3833",
          950: "#0c211e",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 23, 20, 0.04), 0 4px 16px rgba(15, 23, 20, 0.04)",
        lift: "0 2px 6px rgba(15, 23, 20, 0.05), 0 16px 40px -12px rgba(15, 23, 20, 0.16)",
        toolbar: "0 1px 2px rgba(15,23,20,.06), 0 8px 24px -8px rgba(15,23,20,.18)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Newsreader", "Georgia", "serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "forge-rise": {
          "0%": { opacity: "0", transform: "translateY(14px) scale(0.985)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "forge-pop": {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "60%": { opacity: "1", transform: "scale(1.02)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "forge-drift": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "50%": { transform: "translate3d(0, -14px, 0) scale(1.04)" },
        },
        "forge-dash": {
          to: { strokeDashoffset: "-40" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "forge-rise": "forge-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both",
        "forge-pop": "forge-pop 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "forge-drift": "forge-drift 9s ease-in-out infinite",
        "forge-dash": "forge-dash 2.4s linear infinite",
      },
    },
  },
  plugins: [animate],
};

export default config;
