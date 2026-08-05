/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        boletin: {
          50: '#f4f6f8',
          100: '#e6eaef',
          600: '#4a5b70',
          800: '#2b3746',
          900: '#1d2632',
        },
      },
    },
  },
  plugins: [],
}
