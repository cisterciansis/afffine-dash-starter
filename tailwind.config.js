/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FFFEF7',
          100: '#F5F5DC',
          200: '#F0F0C8',
          300: '#EAEAB4',
        }
      },
      fontFamily: {
        mono: ['Courier New', 'monospace'],
        sans: ['Arial', 'Helvetica', 'sans-serif'],
      },
      animation: {
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
};