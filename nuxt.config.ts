import svgLoader from 'vite-svg-loader'
import { fileURLToPath, URL } from 'node:url'

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
  app: {
    head: {
      htmlAttrs: {
        lang: 'en',
      },
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: 'Portfolio',
      titleTemplate: '%s · Tino Kaartovuori',
      meta: [
        {
          name: 'description',
          content:
            'Portfolio of Tino Kaartovuori, a web developer building interactive, motion-driven experiences for the browser.',
        },
        {
          name: 'theme-color',
          content: '#dde0ed',
          media: '(prefers-color-scheme: light)',
        },
        {
          name: 'theme-color',
          content: '#0c0d12',
          media: '(prefers-color-scheme: dark)',
        },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
  colorMode: {
    classSuffix: '',
  },
  vite: {
    plugins: [
      svgLoader(), // https://github.com/jpkleemans/vite-svg-loader#readme
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./', import.meta.url)),
      },
    },
  },
  tailwindcss: {
    viewer: true,
    configPath: '~/tailwind.config.ts',
  },
  googleFonts: {
    download: true,
    preload: true,
    outputDir: './assets/fonts',
    overwriting: false,
    inject: true,
    base64: true,
    families: {
      Outfit: [200, 300, 400, 500, 600, 700, 800],
    },
  },
})
