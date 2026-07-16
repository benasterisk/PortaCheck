/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        // Palette console d'exploitation.
        panel: '#0f1520',
        panel2: '#161d2b',
        edge: '#243044',
      },
    },
  },
  plugins: [],
}
