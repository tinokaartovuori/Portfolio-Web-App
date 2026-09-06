import { queryCollection } from '@nuxt/content/nitro'

/**
 * llms.txt: a plain-text brief of the site for answer engines — who this is,
 * what the work is, and where each piece lives, absolute. Prerendered, so it
 * is a static file and reads the content at build time.
 */
export default defineEventHandler(async (event) => {
  const base = useRuntimeConfig(event).public.siteUrl.replace(/\/$/, '')
  const [home, about, projects] = await Promise.all([
    queryCollection(event, 'home').first(),
    queryCollection(event, 'about').first(),
    queryCollection(event, 'projects').order('order', 'ASC').all(),
  ])

  const lines: string[] = []
  lines.push('# Tino Kaartovuori')
  lines.push('')
  if (home?.description) lines.push(`> ${home.description}`)
  lines.push('')
  if (about?.standfirst) {
    lines.push(about.standfirst)
    lines.push('')
  }

  lines.push('## Work')
  lines.push('')
  for (const p of projects) {
    lines.push(`### ${p.title} (${p.year})`)
    lines.push(p.summary)
    lines.push(`Page: ${base}${p.path}`)
    if (p.website) lines.push(`Website: ${p.website}`)
    for (const link of p.links ?? []) lines.push(`${link.label}: ${link.to}`)
    lines.push('')
  }

  lines.push('## Contact')
  lines.push('')
  if (home?.contact?.email) lines.push(`Email: ${home.contact.email}`)
  for (const link of home?.contact?.links ?? []) {
    if (link.to === 'https://www.linkedin.com/') continue
    lines.push(`${link.label}: ${link.to}`)
  }
  lines.push('')

  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return lines.join('\n')
})
