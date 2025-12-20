/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        outfit: ['var(--font-outfit)', 'sans-serif'],
        quinn: ['var(--font-quinn)', 'sans-serif'],
        'plus-jakarta': ['var(--font-plus-jakarta)', 'sans-serif'],
      },
      screens: {
        mobile: '428px',
        tablet: '768px',
        desktop: '1024px'
      },
      maxWidth: {
        mobile: '428px'
      }
    }
  },
  plugins: []
};
