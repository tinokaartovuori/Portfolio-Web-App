/**
 * The content queries that more than one component makes.
 *
 * `useAsyncData` shares one payload per key, but warns when two callers hand
 * it different handler functions for the same key — the home page and the
 * footer both want `home`, the home page and the about page both want
 * `about`. Going through these keeps the handler one and the same.
 */
export function useHomeContent() {
  return useAsyncData('home', () => queryCollection('home').first())
}

export function useAboutContent() {
  return useAsyncData('about', () => queryCollection('about').first())
}
