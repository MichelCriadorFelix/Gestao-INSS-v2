/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}",
    "./Components/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
            50: '#fdf2f3',
            100: '#fce7e9',
            200: '#f9d2d6',
            300: '#f3acb4',
            400: '#ea7d8a',
            500: '#dd4f60',
            600: '#c83246',
            700: '#a8253a',
            800: '#8b2235',
            900: '#6B1A1F',
            950: '#3e0f12',
        },
        bordeaux: {
            50: '#fdf2f3',
            100: '#fce7e9',
            200: '#f9d2d6',
            300: '#f3acb4',
            400: '#ea7d8a',
            500: '#dd4f60',
            600: '#c83246',
            700: '#a8253a',
            800: '#8b2235',
            900: '#6B1A1F',
            950: '#3e0f12',
        },
        gold: {
            50: '#fdf9ed',
            100: '#faefce',
            200: '#f5dd9b',
            300: '#efc55f',
            400: '#e9b03a',
            500: '#C9A961',
            600: '#b8881f',
            700: '#98671d',
            800: '#7d521f',
            900: '#69431f',
            950: '#3c220d',
        },
        cream: {
            50: '#FAF7F0',
            100: '#F5F1E8',
            200: '#ecdfd2',
            300: '#d9b9a5',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'serif'],
        display: ['"Cormorant Garamond"', 'serif'],
      }
    },
  },
  plugins: [],
}
