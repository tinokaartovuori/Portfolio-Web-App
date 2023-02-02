import svgLoader from 'vite-svg-loader'
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  css: ['~/assets/styles/index.css'],
  components: true,
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@nuxtjs/color-mode',
    '@nuxtjs/google-fonts',
  ],
  colorMode: {
    classSuffix: '',
  },
  vite: {
    plugins: [
      svgLoader(), // https://github.com/jpkleemans/vite-svg-loader#readme
    ],
  },
  tailwindcss: {
    viewer: true,
    configPath: '~/tailwind.config.ts',
  },
  googleFonts: {
    display: 'swap',
    download: true,
    outputDir: './assets/fonts',
    overwriting: false,
    inject: true,
    families: {
      Outfit: [200, 300, 400, 500, 600, 700, 800],
    },
  },
})
