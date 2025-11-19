/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#60a5fa",
          dark: "#3b82f6",
          light: "#93c5fd",
          glow: "rgba(96, 165, 250, 0.4)",
        },
        accent: {
          DEFAULT: "#fb923c",
          dark: "#f97316",
          light: "#fdba74",
          glow: "rgba(251, 146, 60, 0.4)",
        },
        success: {
          DEFAULT: "#22c55e",
          dark: "#16a34a",
          light: "#4ade80",
        },
        danger: {
          DEFAULT: "#ef4444",
          dark: "#dc2626",
          light: "#f87171",
        },
        warning: {
          DEFAULT: "#f59e0b",
          dark: "#d97706",
          light: "#fbbf24",
        },
        background: {
          DEFAULT: "#090d13",
          light: "#0f1419",
          lighter: "#1a1f28",
          card: "#0d1117",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Consolas", "monospace"],
      },
      spacing: {
        4.5: "1.125rem",
        5.5: "1.375rem",
      },
      boxShadow: {
        "glow-primary": "0 0 20px rgba(96, 165, 250, 0.3)",
        "glow-accent": "0 0 20px rgba(251, 146, 60, 0.3)",
        "inner-glow": "inset 0 0 20px rgba(96, 165, 250, 0.1)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "grid-pattern":
          "linear-gradient(rgba(96, 165, 250, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(96, 165, 250, 0.05) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "30px 30px",
      },
    },
  },
  plugins: [],
};
