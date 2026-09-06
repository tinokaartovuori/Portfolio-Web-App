/**
 * Takes a like back. The browser only offers this on a heart it has given
 * itself; the counter never goes below zero, and the same guard as for
 * giving one stands behind it, so a script cannot empty the count any
 * faster than it could fill it.
 */
export default defineEventHandler((event) => {
  if (rateLimited(event, 'like', 10, 60 * 60 * 1000)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many likes' })
  }
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { likes: removeLike() }
})
