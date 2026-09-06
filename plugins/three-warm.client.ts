/**
 * Starts fetching the WebGL layer's chunk (three.js and the scene classes,
 * the largest script on the site) as soon as the app exists, so the download
 * overlaps hydration instead of waiting for `<LazyThreeScrollCanvas>` to
 * mount and ask for it. The import's result is not needed here: the module
 * cache is what the lazy component then hits.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:created', () => {
    void import('~/components/ThreeScrollCanvas.vue').catch(() => {
      // The lazy component will report its own failure, if any
    })
  })
})
