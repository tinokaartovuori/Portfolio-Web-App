import svgLoader from 'vite-svg-loader'
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  css: ['~/assets/styles/index.css'],
  components: true,
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', '@nuxtjs/color-mode'],
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
})
