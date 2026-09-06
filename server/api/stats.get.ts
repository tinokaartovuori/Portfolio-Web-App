/**
 * The numbers, as JSON: likes, views and visitors per day, pages and
 * referrers over the last `days` days (30 by default, 365 at most). Guarded
 * by `runtimeConfig.statsKey` (`NUXT_STATS_KEY`), sent as `?key=` or as a
 * bearer token; without a key configured the route only answers in
 * development.
 */
export default defineEventHandler((event) => {
  const { statsKey } = useRuntimeConfig(event)
  const query = getQuery(event)
  const given =
    (typeof query.key === 'string' ? query.key : null) ??
    getRequestHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '') ??
    ''
  const open = !statsKey && import.meta.dev
  if (!open && (!statsKey || given !== statsKey)) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const requested = Number(query.days)
  const days = Number.isFinite(requested)
    ? Math.min(365, Math.max(1, Math.floor(requested)))
    : 30

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return readStats(days)
})
