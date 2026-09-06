import { ogImageFor, imageMeta } from '~/utils/images'

interface SeoInput {
  /** The bare page title, appended with the name by the layout's template.
   * Omit on the home page to keep the default tagline title. */
  title?: string
  description: string
  /** The page's own path, for the canonical URL. */
  path: string
  /** The content image whose og crop (1200×630) becomes the og:image. */
  image?: string
  imageAlt?: string
  type?: 'website' | 'article'
}

/**
 * One place for a page's title, description, canonical URL and social cards.
 * The og:image is the build's 1200×630 crop of the page's lead image, made
 * absolute; a page with no crop yet falls back to the original file.
 */
export function useSeo(input: SeoInput) {
  const { absolute } = useSiteUrl()
  const url = absolute(input.path)

  const og = input.image ? ogImageFor(input.image) : null
  const meta = input.image ? imageMeta(input.image) : null
  const image = og
    ? absolute(og.src)
    : input.image
      ? absolute(input.image)
      : undefined
  const width = og ? og.width : meta?.width
  const height = og ? og.height : meta?.height

  useSeoMeta({
    title: input.title,
    description: input.description,
    ogTitle: input.title ?? 'Tino Kaartovuori',
    ogDescription: input.description,
    ogType: input.type ?? 'website',
    ogUrl: url,
    ogSiteName: 'Tino Kaartovuori',
    ogLocale: 'en_US',
    ogImage: image,
    ogImageWidth: image ? width : undefined,
    ogImageHeight: image ? height : undefined,
    ogImageAlt: image ? input.imageAlt : undefined,
    twitterCard: 'summary_large_image',
    twitterTitle: input.title ?? 'Tino Kaartovuori',
    twitterDescription: input.description,
    twitterImage: image,
    twitterImageAlt: image ? input.imageAlt : undefined,
  })

  useHead({
    link: [{ rel: 'canonical', href: url }],
  })
}

/**
 * Emits a JSON-LD `@graph` into the head. `innerHTML` is set from data this
 * codebase controls (content frontmatter, the site config), never user input.
 */
export function useJsonLd(graph: Record<string, unknown>[]) {
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': graph,
        }),
      },
    ],
  })
}
