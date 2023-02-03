import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  darkMode: 'class',
  theme: {
    screens: {
      xxs: '320px',
      xs: '450px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },
    extend: {
      colors: {
        onyx: '#111111',
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        outfit: ['Outfit', 'sans-serif'],
      },
    },
  },
  variants: {},
  plugins: [],
}
