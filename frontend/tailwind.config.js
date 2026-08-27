/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: {
          700: '#2b313d',
          750: '#232832',
          800: '#1c2028',
          850: '#14171d',
          900: '#0f1115',
          925: '#0a0c10',
          950: '#08090c',
        },
        brand: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        tactical: {
          amber: '#f59e0b',
          ochre: '#d97706',
          cyan: '#06b6d4',
          crimson: '#e11d48',
          emerald: '#10b981',
          gold: '#eab308',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.25)',
        card: '0 4px 20px -2px rgba(0, 0, 0, 0.35)',
        elevated: '0 10px 30px -4px rgba(0, 0, 0, 0.45)',
      },
    },
  },
  plugins: [],
}
