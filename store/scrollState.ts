import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Scroll position, written once per frame by ScrollContainer and read by
 * everything that reacts to scrolling (ScrollTrack, BottomBar).
 *
 * The WebGL layer does NOT read this store per frame — it takes its values
 * straight from the frame loop, because Vue reactivity does not belong in a
 * 120Hz path.
 */
export const useScrollStateStore = defineStore('scroll-state-store', () => {
  /** Current smoothed scroll offset, in pixels. */
  const scrollY = ref(0)
  /**
   * Scroll velocity in pixels per SECOND.
   *
   * This used to be a per-frame pixel delta, which made the signature shader
   * effect 2.4x weaker on a 144Hz display than on the 60Hz one it was tuned on.
   */
  const scrollYVelocity = ref(0)
  /** Maximum scrollable offset, in pixels. */
  const scrollYMax = ref(0)
  /**
   * Set by a page whose first screen cannot fit the viewport, so the fixed
   * "scroll to discover" prompt does not land on top of its text. Pages that
   * set it are responsible for clearing it on unmount.
   */
  const scrollPromptSuppressed = ref(false)
  /**
   * Border-box height of the current page's hero, or 0 when the page has
   * none. The fixed bars use it to know when their controls have stopped
   * being over the hero. Set and cleared by the page, like the flag above.
   */
  const heroHeight = ref(0)

  return {
    scrollY,
    scrollYVelocity,
    scrollYMax,
    scrollPromptSuppressed,
    heroHeight,
  }
})
