/** robots.txt: everything crawlable but the API, with the sitemap named. */
export default defineEventHandler((event) => {
  const base = useRuntimeConfig(event).public.siteUrl.replace(/\/$/, '')
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${base}/sitemap.xml
`
})
