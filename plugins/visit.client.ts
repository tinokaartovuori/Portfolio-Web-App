import { START_LOCATION } from 'vue-router'

/**
 * Tells `/api/visit` about every page view: once when the app is up and once
 * per route change (a hash jump is not one). The first view of a browser
 * session is marked, with the referrer, so the visitor count and the
 * referrer list are made of sessions rather than clicks. Nothing else is
 * sent, and a failed request is nobody's problem.
 */
const SESSION_KEY = 'portfolio:session'

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()

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
  }

  nuxtApp.hook('app:mounted', () => send(router.currentRoute.value.path))
  router.afterEach((to, from) => {
    // The initial navigation is the one `app:mounted` reports
    if (from === START_LOCATION || to.path === from.path) return
    send(to.path)
  })
})
