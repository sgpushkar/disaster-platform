/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#09090b',
          900: '#111114',
          850: '#151518',
          800: '#18181b',
          700: '#27272a',
          600: '#3f3f46',
        },
        slate: {
          700: '#27272a',
          750: '#1f1f23',
          800: '#18181b',
          850: '#151518',
          900: '#111114',
          925: '#0d0d10',
          950: '#09090b',
        },
        brand: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        signal: {
          red: '#ef4444',
          crimson: '#dc2626',
          dark: '#991b1b',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
        card: '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
        elevated: '0 10px 30px -4px rgba(0, 0, 0, 0.65)',
      },
    },
  },
  plugins: [],
}
