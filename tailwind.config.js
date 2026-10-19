/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        // Material You dynamic color tokens (set at runtime via CSS vars)
        primary: 'var(--md-primary)',
        'on-primary': 'var(--md-on-primary)',
        'primary-container': 'var(--md-primary-container)',
        'on-primary-container': 'var(--md-on-primary-container)',
        secondary: 'var(--md-secondary)',
        'secondary-container': 'var(--md-secondary-container)',
        tertiary: 'var(--md-tertiary)',
        'tertiary-container': 'var(--md-tertiary-container)',
        surface: 'var(--md-surface)',
        'surface-variant': 'var(--md-surface-variant)',
        'on-surface': 'var(--md-on-surface)',
        'on-surface-variant': 'var(--md-on-surface-variant)',
        'surface-container': 'var(--md-surface-container)',
        'surface-container-high': 'var(--md-surface-container-high)',
        'surface-container-highest': 'var(--md-surface-container-highest)',
        outline: 'var(--md-outline)',
        'outline-variant': 'var(--md-outline-variant)',
        error: 'var(--md-error)',
      },
      fontFamily: {
        sans: ['Google Sans', 'Noto Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '28px',
        full: '9999px',
      },
    },
  },
  plugins: [],
};
