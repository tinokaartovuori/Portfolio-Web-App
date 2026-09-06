/**
 * One more like. The browser remembers having liked in `localStorage` and
 * does not ask again; this guard is for anyone who bypasses that.
 */
export default defineEventHandler((event) => {
  if (rateLimited(event, 'like', 10, 60 * 60 * 1000)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many likes' })
  }
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { likes: addLike() }
})
