import type { Config } from "tailwindcss";
import { createPreset } from "fumadocs-ui/tailwind-plugin";

const config: Config = {
  content: [
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./content/**/*.{md,mdx}",
    "./mdx-components.tsx",
    "./node_modules/fumadocs-ui/dist/**/*.js",
  ],
  presets: [createPreset()],
  theme: {
    extend: {
      colors: {
        rust: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#ff8533",
          500: "#FF4F00",  // International Orange
          600: "#e04500",
          700: "#c23d00",
          800: "#9a3412",
          900: "#7c2d12",
          950: "#431407",
        },
      },
    },
  },
};

export default config;
