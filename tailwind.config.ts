import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary, #2563eb)',
          light: 'var(--color-primary-light, #3b82f6)',
          dark: 'var(--color-primary-dark, #1d4ed8)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary, #64748b)',
          light: 'var(--color-secondary-light, #94a3b8)',
          dark: 'var(--color-secondary-dark, #475569)',
        },
        accent: {
          DEFAULT: 'var(--color-accent, #f59e0b)',
          light: 'var(--color-accent-light, #fbbf24)',
          dark: 'var(--color-accent-dark, #d97706)',
        },
        surface: 'var(--color-surface, #f8fafc)',
        background: 'var(--color-background, #ffffff)',
      },
      fontFamily: {
        brand: ['var(--font-brand, "Inter")', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        brand: 'var(--radius-brand, 0.5rem)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
