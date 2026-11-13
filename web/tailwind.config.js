export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: { ink: '#111111', orange: { DEFAULT: '#FF6A00', dark: '#E55F00' } },
      fontFamily: { sans: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'] },
    },
  },
  plugins: [],
}
