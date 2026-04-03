/** @type {import('tailwindcss').Config} */
export default {
  content: ['./client/src/**/*.{js,jsx}', './client/index.html'],
  theme: {
    extend: {
      colors: {
        'primary':                   '#00372c',
        'primary-container':         '#104f42',
        'on-primary':                '#ffffff',
        'secondary':                 '#006d3c',
        'secondary-fixed':           '#87f9af',
        'surface':                   '#ffffff',
        'surface-container-low':     '#f8f9fa',
        'surface-container':         '#f8f9fa',
        'surface-container-highest': '#f1f3f5',
        'surface-container-lowest':  '#ffffff',
        'surface-variant':           '#f1f3f5',
        'on-surface':                '#1f1b15',
        'on-surface-variant':        '#404945',
        'outline-variant':           '#bfc9c4',
        'error':                     '#ba1a1a',
        'error-container':           '#ffdad6',
        'on-error-container':        '#93000a',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.375rem',
        sm: '0.25rem',
        md: '0.375rem',
        lg: '0.375rem',
      }
    }
  },
  plugins: []
}
