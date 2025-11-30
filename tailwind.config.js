/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Bitcoin Palette Colors (from attached image)
        'btc': {
          50: '#fef7ed',
          100: '#fdedd3',
          200: '#fbd7a5',
          300: '#f9b86d',
          400: '#f59332',
          500: '#f2761b',  // Main Bitcoin orange
          600: '#e35d11',
          700: '#bc4510',
          800: '#953614',
          900: '#782e13',
          950: '#411404',
        },
        
        // Enhanced color palette for light/dark modes
        'profit': {
          DEFAULT: '#22c55e',
          dark: '#16a34a',
          light: '#dcfce7',
        },
        'loss': {
          DEFAULT: '#ef4444',
          dark: '#dc2626',
          light: '#fef2f2',
        },
        'bitcoin': {
          DEFAULT: '#f2761b',
          light: '#f59332',
          dark: '#e35d11',
        },
      },
      
      // Custom fonts
      fontFamily: {
        'sans': ['JetBrains Mono', 'Monaco', 'monospace'],
        'mono': ['JetBrains Mono', 'Monaco', 'monospace'],
      },
      
      // Custom spacing
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      
      // Custom border radius
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      
      // Custom box shadows for dark theme
      boxShadow: {
        'dark': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
        'dark-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
      },
      
      // Custom animations
      animation: {
        'fadeIn': 'fadeIn 0.3s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} 