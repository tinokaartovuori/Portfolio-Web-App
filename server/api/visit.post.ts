/**
 * One page view. `plugins/visit.client.ts` sends it on load and on every
 * route change; `session` is true for the first view of a browser session,
 * which is what the visitor count is made of. The referrer is reduced to its
 * host and dropped when it is this site.
 *
 * Crawlers are declined by user agent — a rough net, but the alternative is
 * an honest count of nothing.
 */
const BOT =
  /bot|crawl|spider|slurp|headless|lighthouse|preview|fetch|curl|wget|python|monitor|scan/i

const PATH = /^\/[^\s?#]{0,199}$/

export default defineEventHandler(async (event) => {
  const agent = getRequestHeader(event, 'user-agent') ?? ''
  if (!agent || BOT.test(agent)) return { ok: false }
  if (rateLimited(event, 'visit', 120, 60 * 1000)) return { ok: false }

  const body = (await readBody(event)) as unknown
  if (!isVisit(body)) {
    throw createError({ statusCode: 400, statusMessage: 'Bad visit' })
  }

  recordView(body.path)
  if (body.session) {
    recordSession(referrerHost(body.referrer, getRequestHost(event)))
  }
  return { ok: true }
})

interface Visit {
  path: string
  referrer?: string
  session?: boolean
}

function isVisit(body: unknown): body is Visit {
  if (typeof body !== 'object' || body === null) return false
  const { path, referrer, session } = body as Record<string, unknown>
  return (
    typeof path === 'string' &&
    PATH.test(path) &&
    (referrer === undefined ||
      (typeof referrer === 'string' && referrer.length <= 2000)) &&
    (session === undefined || typeof session === 'boolean')
  )
}

function referrerHost(referrer: string | undefined, own: string) {
  if (!referrer) return null
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '')
    const ownHost = own.split(':')[0]?.replace(/^www\./, '')
    return host && host !== ownHost ? host : null
  } catch {
    return null
  }
}
