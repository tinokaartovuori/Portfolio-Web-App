import manifestJson from '~/assets/images.gen.json'
import type { GeneratedImage, ImageManifest } from '~/scripts/images.d.mts'

/**
 * What the build knows about each image under `public/images/`: its size,
 * the responsive widths `scripts/images.mjs` wrote, and its og crop. The
 * manifest is generated (and empty on a checkout that has not run the
 * script), so every lookup may come back null and callers fall back to the
 * original file.
 */
const manifest = manifestJson as ImageManifest

export type ImageMeta = GeneratedImage

export const OG_SIZE = { width: 1200, height: 630 } as const

export function imageMeta(url: string): ImageMeta | null {
  return manifest[url] ?? null
}

export type ImageFormat = 'avif' | 'webp' | 'jpg'

/** `/images/<name>.jpg` → `/images/gen/<name>` */
function generatedBase(url: string) {
  const file = url.slice(url.lastIndexOf('/') + 1)
  const name = file.replace(/\.[^.]+$/, '')
  return `/images/gen/${name}`
}

/** The `srcset` for one format, or an empty string when nothing was generated. */
export function srcsetFor(url: string, format: ImageFormat) {
  const meta = imageMeta(url)
  if (!meta) return ''
  const base = generatedBase(url)
  return meta.widths.map((w) => `${base}-${w}.${format} ${w}w`).join(', ')
}

/** The largest generated candidate in a format: the `src` fallback. */
export function largestFor(url: string, format: ImageFormat) {
  const meta = imageMeta(url)
  if (!meta) return url
  const w = meta.widths[meta.widths.length - 1]
  return `${generatedBase(url)}-${w}.${format}`
}

/** The og:image for a content image, if the build made one. */
export function ogImageFor(url: string) {
  const meta = imageMeta(url)
  if (!meta) return null
  return { src: meta.og, ...OG_SIZE }
}
