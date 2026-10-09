/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // CSS variable-based colors (shadcn)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          // Readable orange for text/icons on light surfaces and tints
          strong: "hsl(var(--primary-strong))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        // Soft tints for tiles/chips/badges — pair bg-tint-x with text-tint-x-fg
        tint: {
          orange: "hsl(var(--tint-orange))",
          green: "hsl(var(--tint-green))",
          "green-fg": "hsl(var(--tint-green-fg))",
          red: "hsl(var(--tint-red))",
          "red-fg": "hsl(var(--tint-red-fg))",
          blue: "hsl(var(--tint-blue))",
          "blue-fg": "hsl(var(--tint-blue-fg))",
          purple: "hsl(var(--tint-purple))",
          "purple-fg": "hsl(var(--tint-purple-fg))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        
        // Bitcoin Orange palette (for direct usage)
        btc: {
          50: '#fef7ed',
          100: '#fdedd3',
          200: '#fbd7a5',
          300: '#f9b86d',
          400: '#f59332',
          500: '#f2761b',   // Primary Bitcoin Orange
          600: '#e35d11',
          700: '#bc4510',
          800: '#953614',
          900: '#782e13',
          950: '#411404',
        },
        
        // Semantic colors
        profit: {
          DEFAULT: '#22c55e',
          dark: '#16a34a',
          light: '#dcfce7',
        },
        loss: {
          DEFAULT: '#ef4444',
          dark: '#dc2626',
          light: '#fef2f2',
        },
        bitcoin: {
          DEFAULT: '#f7931a',
          light: '#f9a847',
          dark: '#e07d0a',
        },
        
        // Neutral dark palette (no blue tint) - for legacy components
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          850: '#1f1f1f',
          900: '#171717',
          925: '#121212',
          950: '#0a0a0a',
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        // Friendly, generous radii: cards 24px, hero surfaces 28px
        "2xl": "1.5rem",
        "3xl": "1.75rem",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // Signature shadow system (values are mode-aware via CSS vars in globals.css)
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        glow: "var(--shadow-glow)",
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        // Entrance: cards rise into place (staggered via animation-delay)
        rise: {
          '0%': { opacity: '0', transform: 'translateY(16px) scale(0.985)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        // Small elements (chips, badges) pop in with a slight overshoot
        pop: {
          '0%': { opacity: '0', transform: 'scale(0.6)' },
          '70%': { transform: 'scale(1.06)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        // Hover nudges for icons: one small gesture per hover, matching the icon
        'nudge-up': {
          '0%, 100%': { transform: 'translateY(0)' },
          '40%': { transform: 'translateY(-4px)' },
          '70%': { transform: 'translateY(1px)' },
        },
        'nudge-down': {
          '0%, 100%': { transform: 'translateY(0)' },
          '40%': { transform: 'translateY(4px)' },
          '70%': { transform: 'translateY(-1px)' },
        },
        'nudge-x': {
          '0%, 100%': { transform: 'translateX(0)' },
          '30%': { transform: 'translateX(4px)' },
          '65%': { transform: 'translateX(-3px)' },
        },
        hop: {
          '0%, 100%': { transform: 'translateY(0)' },
          '35%': { transform: 'translateY(-5px)' },
          '60%': { transform: 'translateY(0)' },
          '78%': { transform: 'translateY(-1.5px)' },
        },
        // A milestone just reached: swell and send out one ring
        celebrate: {
          '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 hsl(var(--primary) / 0.55)' },
          '35%': { transform: 'scale(1.14)' },
          '60%': { transform: 'scale(0.96)' },
          '100%': { transform: 'scale(1)', boxShadow: '0 0 0 14px hsl(var(--primary) / 0)' },
        },
        // Chart marker found from elsewhere (e.g. hovering its transaction row)
        'marker-pulse': {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(3.2)', opacity: '0' },
        },
        // A row that was just added, edited or imported: a brief warm glow
        'row-arrive': {
          '0%': { backgroundColor: 'hsl(var(--primary) / 0.22)' },
          '100%': { backgroundColor: 'hsl(var(--primary) / 0)' },
        },
        // Live dot ripple
        'live-pulse': {
          '0%': { boxShadow: '0 0 0 0 rgb(34 197 94 / 0.55)' },
          '100%': { boxShadow: '0 0 0 10px rgb(34 197 94 / 0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-in-out',
        fadeInUp: 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 2s infinite',
        rise: 'rise 0.7s cubic-bezier(0.2, 0.75, 0.2, 1) both',
        pop: 'pop 0.5s cubic-bezier(0.3, 1.4, 0.5, 1) both',
        'live-pulse': 'live-pulse 1.6s ease-out infinite',
        'nudge-up': 'nudge-up 0.5s cubic-bezier(0.3, 1.4, 0.5, 1)',
        'nudge-down': 'nudge-down 0.5s cubic-bezier(0.3, 1.4, 0.5, 1)',
        'nudge-x': 'nudge-x 0.55s cubic-bezier(0.3, 1.4, 0.5, 1)',
        hop: 'hop 0.6s ease-out',
        celebrate: 'celebrate 0.9s cubic-bezier(0.3, 1.4, 0.5, 1) backwards',
        'row-arrive': 'row-arrive 2.2s ease-out',
        'marker-pulse': 'marker-pulse 1.2s ease-out infinite',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
  safelist: [
    'col-span-1', 'col-span-2', 'col-span-3', 'col-span-4',
    'row-span-1', 'row-span-2', 'row-span-3',
  ],
}
