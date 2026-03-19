/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        // Professional Business Blue System
        primary: {
          DEFAULT: '#2563EB', // Blue 600 - Professional blue
          light: '#3B82F6',   // Blue 500 - Lighter blue
          lighter: '#60A5FA', // Blue 400 - Even lighter
          dark: '#1D4ED8',    // Blue 700 - Darker blue
        },
        secondary: {
          DEFAULT: '#0891B2', // Cyan 600 - Modern cyan
          light: '#06B6D4',   // Cyan 500
          dark: '#0E7490',    // Cyan 700
        },
        accent: {
          DEFAULT: '#6366F1', // Indigo 500 - Modern indigo
          light: '#818CF8',   // Indigo 400
          dark: '#4F46E5',    // Indigo 600
        },
        success: '#10B981',    // Emerald 500
        warning: '#F59E0B',    // Amber 500
        error: '#EF4444',      // Red 500

        // Neutral Grays for Light Theme
        background: {
          DEFAULT: '#F8FAFC',  // Slate 50
          light: '#F1F5F9',    // Slate 100
          card: '#FFFFFF',     // Pure white
        },
        surface: '#FFFFFF',
        border: {
          DEFAULT: '#E2E8F0',  // Slate 200
          light: '#F1F5F9',    // Slate 100
        },
        text: {
          primary: '#0F172A',    // Slate 900
          secondary: '#475569',  // Slate 600
          muted: '#94A3B8',      // Slate 400
        },
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'slide-in': 'slideIn 200ms ease-out',
        'slide-in-right': 'slideInRight 300ms ease-out',
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
      zIndex: {
        sidebar: 10,
        'right-sidebar': 40,
        modal: 50,
        tooltip: 100,
      },
      boxShadow: {
        'soft': '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'soft-md': '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        'soft-lg': '0 10px 15px -3px rgb(0 0 0 / 0.05), 0 4px 6px -4px rgb(0 0 0 / 0.05)',
        'card': '0 1px 2px 0 rgb(0 0 0 / 0.03)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
      },
      borderRadius: {
        'lg': '0.75rem',
        'xl': '1rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
