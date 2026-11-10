import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
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
          soft: "hsl(var(--primary-soft))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          soft: "hsl(var(--destructive-soft))",
        },
        danger: {
          DEFAULT: "#D64545",
          soft: "#FDEDED",
        },
        "danger-soft": "#FDEDED",
        success: {
          DEFAULT: "#16845B",
          foreground: "#FFFFFF",
          soft: "#EAF7F0",
        },
        "success-soft": "#EAF7F0",
        warning: {
          DEFAULT: "#D98E04",
          foreground: "#FFFFFF",
          soft: "#FFF5E5",
        },
        "warning-soft": "#FFF5E5",
        info: {
          DEFAULT: "#5B61D6",
          soft: "#F0F1FD",
        },
        "info-soft": "#F0F1FD",
        "blue-soft": "#EDF3FF",
        navy: "#183153",
        surface: "#FFFFFF",
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
        sidebar: {
          DEFAULT: "hsl(var(--sidebar, 0 0% 100%))",
          foreground: "hsl(var(--sidebar-foreground, 222 47% 11%))",
          primary: "hsl(var(--sidebar-primary, 221 83% 53%))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground, 0 0% 100%))",
          accent: "hsl(var(--sidebar-accent, 210 40% 96%))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground, 222 47% 11%))",
          border: "hsl(var(--sidebar-border, 214.3 31.8% 91.4%))",
          ring: "hsl(var(--sidebar-ring, 221 83% 53%))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
