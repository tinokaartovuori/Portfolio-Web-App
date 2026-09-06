import { queryCollection } from '@nuxt/content/nitro'

/**
 * The sitemap: the home page and every project page, absolute. Prerendered
 * (see nuxt.config `nitro.prerender.routes`), so it is a static file in
 * production and never touches the database at request time.
 */
export default defineEventHandler(async (event) => {
  const base = useRuntimeConfig(event).public.siteUrl.replace(/\/$/, '')
  const projects = await queryCollection(event, 'projects')
    .order('order', 'ASC')
    .all()

  const urls = [
    { loc: `${base}/`, priority: '1.0' },
    ...projects.map((p) => ({ loc: `${base}${p.path}`, priority: '0.8' })),
  ]

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url><loc>${u.loc}</loc><priority>${u.priority}</priority></url>`,
  )
  .join('\n')}
</urlset>
`
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return body
})
