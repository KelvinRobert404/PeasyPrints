/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
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
