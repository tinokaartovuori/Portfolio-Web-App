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
  // Generates the responsive images, og crops and favicon set on dev start
  // and build (scripts/images.mjs), so `public/images/gen` is never committed
  modules: [
    '~/modules/images',
    '@pinia/nuxt',
    '@nuxtjs/color-mode',
    '@nuxt/fonts',
    '@nuxt/content',
  ],
  // The site is one page; the old about page's address lands on its section
  routeRules: {
    '/about': { redirect: { to: '/#about', statusCode: 301 } },
    // The generated derivatives are content-hashed by width, so they can be
    // cached forever; the originals a little, in case one is replaced in place
    '/images/gen/**': {
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    },
    '/images/og/**': {
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    },
    '/images/**': {
      headers: {
        'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    },
    '/api/**': { headers: { 'cache-control': 'no-store' } },
  },
  /*
   * The pages are prerendered at build time and served as files; the server
   * that comes out of `nuxt build` is there for the API under `server/`
   * (the likes and the visit log), which a static host could not run.
   */
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/', '/sitemap.xml', '/robots.txt', '/llms.txt'],
      // The /about 301 is a route rule; without this the crawler also writes
      // a static about/index.html meta-refresh page that would shadow it
      ignore: ['/about'],
    },
    // Brotli and gzip the prerendered pages, the JS and the CSS at build time;
    // the Nitro static handler serves the .br/.gz and Caddy passes it through
    compressPublicAssets: { gzip: true, brotli: true },
  },
  runtimeConfig: {
    /** Where the SQLite file lives; `NUXT_DATA_DIR` in production. */
    dataDir: '.data/site',
    /** Unlocks `/api/stats`; `NUXT_STATS_KEY`. Empty: dev only. */
    statsKey: '',
    public: {
      /** The site's own origin, for canonical URLs, og:image and JSON-LD;
       * `NUXT_PUBLIC_SITE_URL`. No trailing slash. */
      siteUrl: 'https://tino.kaartovuori.fi',
    },
  },
  components: true,
  app: {
    head: {
      htmlAttrs: {
        lang: 'en',
      },
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      // No default title here: the layout's title template supplies it for a
      // page that sets none (the home page), and a static one would be run
      // through that template and come out with the name appended twice
      meta: [
        {
          // The fallback for a page that sets none; the home page and the
          // projects set their own (content/home.yml, the project summary)
          name: 'description',
          content:
            'Tino Kaartovuori is a software engineer in Salo, Finland, who designs and builds web apps, AI automation, software and hardware for clients in Turku, Helsinki and across southern Finland.',
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
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        {
          rel: 'icon',
          type: 'image/x-icon',
          sizes: '32x32',
          href: '/favicon.ico',
        },
        {
          rel: 'apple-touch-icon',
          sizes: '180x180',
          href: '/apple-touch-icon.png',
        },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
    },
  },
  content: {
    experimental: {
      // Node ships a SQLite binding from 22.5, so the content database needs no
      // better-sqlite3 native build — nothing to compile on any machine
      sqliteConnector: 'native',
    },
  },
  colorMode: {
    classSuffix: '',
  },
  fonts: {
    // Only the weights and the subset the site actually uses (the copy is
    // English), and preloaded so the hero text does not wait for the CSS to
    // parse before the face is even discovered
    families: [
      {
        name: 'Outfit',
        provider: 'google',
        weights: [400, 500],
        subsets: ['latin'],
        preload: true,
      },
    ],
  },
  vite: {
    plugins: [
      svgLoader(), // https://github.com/jpkleemans/vite-svg-loader#readme
      tailwindcss(), // Tailwind 4 is configured in assets/styles/index.css
    ],
  },
})
