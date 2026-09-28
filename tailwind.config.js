/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./product.html",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border, 38 20% 86%))",
        input: "hsl(var(--input, 38 20% 86%))",
        ring: "hsl(var(--ring, 142 45% 18%))",
        background: "hsl(var(--background, 40 33% 97%))",
        foreground: "hsl(var(--foreground, 145 35% 12%))",
        primary: {
          DEFAULT: "hsl(var(--primary, 142 45% 18%))",
          foreground: "hsl(var(--primary-foreground, 0 0% 100%))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary, 348 60% 28%))",
          foreground: "hsl(var(--secondary-foreground, 0 0% 100%))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted, 38 25% 91%))",
          foreground: "hsl(var(--muted-foreground, 145 15% 40%))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent, 38 55% 54%))",
          foreground: "hsl(var(--accent-foreground, 145 35% 12%))",
        },
      },
      borderRadius: {
        lg: "var(--radius, 12px)",
        md: "calc(var(--radius, 12px) - 2px)",
        sm: "calc(var(--radius, 12px) - 4px)",
      },
    },
  },
  plugins: [],
}
