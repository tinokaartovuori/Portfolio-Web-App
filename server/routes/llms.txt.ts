import { queryCollection } from '@nuxt/content/nitro'

/**
 * llms.txt: a plain-text brief of the site for answer engines — who this is,
 * where, what is offered and where, what the work is, and where each piece
 * lives, absolute. Prerendered, so it is a static file and reads the content
 * at build time.
 */

/** A minimark node: a string, or `[tag, props, ...children]`. */
type Node = string | [string, Record<string, unknown>, ...Node[]]

/** The text of a node, its children joined. */
function text(node: Node): string {
  if (typeof node === 'string') return node
  return node
    .slice(2)
    .map((child) => text(child as Node))
    .join('')
}

/** The body's paragraphs as plain text, one line each, in order. */
function paragraphs(body: unknown): string[] {
  const tree = body as { value?: Node[] } | null
  return (tree?.value ?? [])
    .filter((node) => typeof node !== 'string' && node[0] === 'p')
    .map((node) => text(node).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

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

  if (about) {
    const { location } = about
    lines.push('## About')
    lines.push('')
    lines.push(`Occupation: ${about.jobTitle}`)
    const { education } = about
    lines.push(
      `Education: ${education.degree} in ${education.field}` +
        (education.major ? ` (major: ${education.major})` : '') +
        `, ${education.school}` +
        (education.year ? `, ${education.year}` : ''),
    )
    lines.push(
      `Location: ${location.city}, ${location.region}, ${location.country}`,
    )
    lines.push(`Works in: ${about.areaServed.join(', ')}, and remote`)
    lines.push('Languages: Finnish, English')
    lines.push('')
    lines.push(about.standfirst)
    lines.push('')
    for (const p of paragraphs(about.body)) {
      lines.push(p)
      lines.push('')
    }
    lines.push(about.availability.en)
    lines.push('')
    lines.push(about.availability.fi)
    lines.push('')
    lines.push(`## ${about.offersTitle}`)
    lines.push('')
    for (const offer of about.offers) lines.push(`- ${offer}`)
    lines.push('')
    lines.push('## Skills')
    lines.push('')
    lines.push(
      [...new Set([...(home?.marquee ?? []), ...about.skills])].join(', '),
    )
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
    lines.push(`${link.label}: ${link.to}`)
  }
  lines.push('')

  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return lines.join('\n')
})
