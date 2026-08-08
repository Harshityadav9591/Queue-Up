/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // <--- THIS IS THE MAGIC SWITCH
  theme: {
    extend: {
      colors: {
        'primary-1': 'var(--color-primary-1)',
        'primary-2': 'var(--color-primary-2)',
        'primary-3': 'var(--color-primary-3)',
        'accent-1': 'var(--color-accent-1)',
        'accent-2': 'var(--color-accent-2)',
        'neutral-2': 'var(--color-neutral-2)',
        'neutral-3': 'var(--color-neutral-3)',
      },
    },
  },
  plugins: [],
}