/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          500: '#15803d',
          600: '#166534',
          700: '#14532d',
        },
        navy: {
          800: '#0f172a',
          900: '#090d16',
          950: '#05070c',
        },
        primary: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
          subtle: '#eff6ff',
        },
        khata: {
          red: '#dc2626',      // You Gave / Debit
          green: '#16a34a',    // You Got / Credit
          yellow: '#ca8a04',   // Due soon
        }
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 10px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
        'elevated': '0 10px 30px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}
