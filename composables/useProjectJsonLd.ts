import { imageMeta } from '~/utils/images'

/**
 * Anything from a project's frontmatter the JSON-LD needs. Kept loose: the
 * content collection's inferred type is not exported, and these are the
 * fields this builder reads.
 */
export interface ProjectLd {
  title: string
  summary: string
  image: string
  imageAlt?: string
  path: string
  year?: string
  date?: string
  duration?: string
  schemaType?:
    'SoftwareApplication' | 'VideoObject' | 'VideoGame' | 'CreativeWork'
  operatingSystem?: string
  website?: string
  rating?: { value?: string; source?: string | string[] }
  links?: Array<{ label: string; to: string; icon?: string }>
  gallery?: Array<{ image: string; imageAlt?: string }>
}

/** The YouTube video id from a youtu.be or watch URL, or null. */
function youTubeId(url: string) {
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/)([\w-]{11})/)
  return m ? m[1] : null
}

/**
 * The `@graph` for a project page: a Person (the author), a BreadcrumbList,
 * and the work itself as the type its frontmatter names, with the fields that
 * type earns a rich result from. `person` is the Person node built by the
 * home page's identity, referenced here by `@id`.
 */
export function buildProjectGraph(
  project: ProjectLd,
  absolute: (path?: string) => string,
) {
  const personId = `${absolute('/')}#person`
  const url = absolute(project.path)
  const image = absolute(project.image)
  const meta = imageMeta(project.image)

  const work: Record<string, unknown> = {
    '@type': project.schemaType ?? 'CreativeWork',
    '@id': `${url}#work`,
    name: project.title,
    description: project.summary,
    url,
    image: meta
      ? {
          '@type': 'ImageObject',
          url: image,
          width: meta.width,
          height: meta.height,
        }
      : image,
    author: { '@id': personId },
    creator: { '@id': personId },
  }
  if (project.date) work.datePublished = project.date
  else if (project.year) work.datePublished = project.year

  if (project.rating?.value) {
    const source = project.rating.source
    work.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: project.rating.value,
      bestRating: '5',
      // A source with no count is not a valid AggregateRating on its own, so
      // name where it is from as the reviewer instead of inventing a count
      author: Array.isArray(source) ? source.join(', ') : source,
    }
  }

  if (project.schemaType === 'SoftwareApplication') {
    work.applicationCategory = 'UtilitiesApplication'
    if (project.operatingSystem) work.operatingSystem = project.operatingSystem
    work.offers = { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
    if (project.website) work.url = project.website
    const stores = (project.links ?? []).map((l) => l.to)
    if (stores.length) work.sameAs = stores
  }

  if (project.schemaType === 'VideoObject') {
    const link = (project.links ?? []).find((l) => youTubeId(l.to))
    const id = link ? youTubeId(link.to) : null
    work.thumbnailUrl = image
    work.uploadDate = project.date ?? project.year
    if (project.duration) work.duration = project.duration
    if (id) {
      work.embedUrl = `https://www.youtube.com/embed/${id}`
      work.contentUrl = link!.to
    }
    work.inLanguage = 'fi'
  }

  if (project.schemaType === 'VideoGame') {
    work.gamePlatform = project.operatingSystem ?? 'Web browser'
    const site = project.website ?? project.links?.[0]?.to
    if (site) work.url = site
    const repo = (project.links ?? []).find((l) => /github\.com/.test(l.to))
    if (repo) work.codeRepository = repo.to
  }

  if (project.schemaType === 'CreativeWork' || !project.schemaType) {
    if (project.gallery?.length) {
      work.image = [image, ...project.gallery.map((g) => absolute(g.image))]
    }
  }

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absolute('/') },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Work',
        item: absolute('/#work'),
      },
      { '@type': 'ListItem', position: 3, name: project.title, item: url },
    ],
  }

  return [work, breadcrumb]
}
