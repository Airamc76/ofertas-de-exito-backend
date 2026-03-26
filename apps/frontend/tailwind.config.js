/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: "#0a0c14",
        emerald: {
          500: "#10b981",
        },
        indigo: {
          500: "#6366f1",
        }
      },
      backgroundImage: {
        'premium-gradient': 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0a0c14 70%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
