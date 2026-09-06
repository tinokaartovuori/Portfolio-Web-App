/**
 * The site's own origin (`runtimeConfig.public.siteUrl`, `NUXT_PUBLIC_SITE_URL`)
 * and a helper to make a path absolute against it — for canonical URLs, the
 * og:image and every `@id`/`url` in the JSON-LD, all of which need a full URL a
 * crawler on another host can resolve.
 */
export function useSiteUrl() {
  const base = useRuntimeConfig().public.siteUrl.replace(/\/$/, '')
  const absolute = (path = '/') =>
    path.startsWith('http') ? path : base + path
  return { base, absolute }
}
