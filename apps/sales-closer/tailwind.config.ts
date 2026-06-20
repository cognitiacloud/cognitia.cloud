import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Off-white boardroom canvas + crisp surfaces.
        canvas: '#F4F6F9',
        surface: '#FFFFFF',
        ink: '#0B1220',
        // Deep navy — primary brand.
        navy: {
          DEFAULT: '#0B2447',
          50: '#EEF2F8',
          100: '#DCE4F0',
          600: '#15356A',
          700: '#0E2A55',
          800: '#0B2447',
          900: '#071A37',
        },
        // Controlled gold accent — used sparingly for emphasis / A-tier.
        gold: {
          DEFAULT: '#B9892F',
          soft: '#FBF3DD',
          200: '#ECD9A6',
          600: '#A5781F',
        },
        // Small cyan/mint tech accent.
        mint: {
          DEFAULT: '#0FB5A6',
          soft: '#E1F6F3',
          600: '#0C988B',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11, 36, 71, 0.04), 0 1px 3px rgba(11, 36, 71, 0.06)',
        panel: '0 4px 16px rgba(11, 36, 71, 0.08)',
      },
      borderRadius: {
        xl: '0.875rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
