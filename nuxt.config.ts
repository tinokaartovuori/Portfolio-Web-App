import svgLoader from 'vite-svg-loader'
import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Pin the behaviour date so a build cannot differ between two machines
  compatibilityDate: '2026-09-04',
  future: {
    // Opt into Nuxt 4 defaults while still on 3.x, so breakages arrive one at a
    // time rather than all at once with the major bump
    compatibilityVersion: 4,
  },
  css: ['~/assets/styles/index.css'],
  components: true,
  modules: ['@pinia/nuxt', '@nuxtjs/color-mode', '@nuxt/fonts'],
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
  fonts: {
    // Only the weights the site actually uses; the old module inlined seven
    // weights across two subsets as 444 KB of base64
    families: [{ name: 'Outfit', provider: 'google', weights: [400, 500] }],
  },
  vite: {
    plugins: [
      svgLoader(), // https://github.com/jpkleemans/vite-svg-loader#readme
      tailwindcss(), // Tailwind 4 is configured in assets/styles/index.css
    ],
  },
})
