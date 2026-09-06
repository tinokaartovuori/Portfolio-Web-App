/** The like count, read by the heart in the top bar once the page is up. */
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { likes: getLikes() }
})
