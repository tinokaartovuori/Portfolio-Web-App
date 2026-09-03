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

  return { scrollY, scrollYVelocity, scrollYMax }
})
