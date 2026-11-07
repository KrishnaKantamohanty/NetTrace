/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cyber: {
          950: '#030712',
          900: '#0b0f19',
          800: '#111827',
          700: '#1f2937',
          600: '#374151',
          accent: '#06b6d4',
          neon: '#10b981',
          alert: '#f43f5e',
          warning: '#f59e0b',
          purple: '#8b5cf6'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
