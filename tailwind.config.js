/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        poppins: ['"Product Sans"', 'sans-serif'],
        display: ['"Product Sans"', 'sans-serif'],
        quinn: ['var(--font-quinn)', 'sans-serif'],
        dmSans: ['var(--font-dm-sans)', 'sans-serif'],
        sans: ['var(--font-dm-sans)', 'sans-serif'],
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
