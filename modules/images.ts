import { defineNuxtModule } from 'nuxt/kit'
import { generateImages } from '../scripts/images.mjs'

/**
 * Runs `scripts/images.mjs` whenever Nuxt loads — dev start, build, typecheck
 * — so the responsive derivatives, the og images, the favicon set and the
 * manifest (`assets/images.gen.json`) always match `public/images/*`. A
 * derivative newer than its source is skipped, so the steady-state cost is a
 * directory listing.
 */
export default defineNuxtModule({
  meta: { name: 'images' },
  async setup(_options, nuxt) {
    await generateImages(nuxt.options.rootDir, {
      log: (message: string) => console.log(message),
    })
  },
})
