import type { Config } from 'tailwindcss';

// Design tokens straight from Blueprint §5.1/§5.2/§5.3 — do not introduce
// ad-hoc colors or radii elsewhere; extend this file instead.
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1E5FBF', pressed: '#174890' },
        accent: { DEFAULT: '#FFC107', pressed: '#E0A800' },
        ground: '#EAF2FA',
        ink: '#333333',
        muted: '#6B7A8D',
        border: '#D7E3F2',
        success: '#1E8E5A',
        warning: '#FFC107',
        danger: '#C0392B',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        card: '8px',
      },
      boxShadow: {
        1: '0 1px 3px rgba(30,95,191,.08)',
        2: '0 4px 12px rgba(30,95,191,.12)',
        3: '0 12px 32px rgba(30,95,191,.18)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.4s ease',
      },
    },
  },
  plugins: [],
};
export default config;
