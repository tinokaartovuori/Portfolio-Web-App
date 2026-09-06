import { START_LOCATION } from 'vue-router'

/**
 * Tells `/api/visit` about every page view: once when the app is up and once
 * per route change (a hash jump is not one). The first view of a browser
 * session is marked, with the referrer, so the visitor count and the
 * referrer list are made of sessions rather than clicks. Nothing else is
 * sent, and a failed request is nobody's problem.
 *
 * The same views go to GoatCounter (`runtimeConfig.public.goatcounter`),
 * which has the dashboard. Its script is loaded here rather than from the
 * document head, with its own page-load count turned off, so the two logs
 * count the same thing; where a blocker stops it, the site's own log still
 * has the view.
 */
const SESSION_KEY = 'portfolio:session'

interface GoatCounter {
  endpoint?: string
  no_onload?: boolean
  count: (vars: { path: string }) => void
}

declare global {
  interface Window {
    goatcounter?: GoatCounter
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  const goatcounter = useRuntimeConfig().public.goatcounter

  let stats: Promise<GoatCounter | undefined> | undefined
  const loadStats = () =>
    (stats ??= new Promise((resolve) => {
      if (!goatcounter || import.meta.dev) return resolve(undefined)
      // count.js keeps whatever is on this object as its settings
      window.goatcounter = {
        endpoint: `${goatcounter}/count`,
        no_onload: true,
      } as GoatCounter
      const script = document.createElement('script')
      script.async = true
      script.src = `${goatcounter}/count.js`
      script.onload = () => resolve(window.goatcounter)
      script.onerror = () => resolve(undefined)
      document.head.append(script)
    }))

  const send = (path: string) => {
    let session = false
    try {
      if (!sessionStorage.getItem(SESSION_KEY)) {
        sessionStorage.setItem(SESSION_KEY, '1')
        session = true
      }
    } catch {
      // No session storage: every view counts as a visit, the honest fallback
      session = true
    }
    $fetch('/api/visit', {
      method: 'POST',
      body: {
        path,
        referrer: session ? document.referrer || undefined : undefined,
        session,
      },
      keepalive: true,
    }).catch(() => {})
    loadStats().then((gc) => gc?.count({ path }))
  }

  nuxtApp.hook('app:mounted', () => send(router.currentRoute.value.path))
  router.afterEach((to, from) => {
    // The initial navigation is the one `app:mounted` reports
    if (from === START_LOCATION || to.path === from.path) return
    send(to.path)
  })
})
