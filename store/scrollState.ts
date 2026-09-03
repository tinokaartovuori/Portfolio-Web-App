import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Scroll position, written by ScrollContainer and read by everything that
 * reacts to scrolling (ThreeScrollCanvas, ScrollTrack, BottomBar).
 *
 * `scrollYSpeed` is a per-frame delta in pixels, not pixels per second — it is
 * therefore refresh-rate dependent. Converting it is part of the motion rework.
 */
export const useScrollStateStore = defineStore('scroll-state-store', () => {
  /** Current scroll offset in pixels, including overscroll bounce. */
  const scrollY = ref(0)
  /** Change in `scrollY` since the previous frame, in pixels. */
  const scrollYSpeed = ref(0)
  /** Maximum scrollable offset in pixels. */
  const scrollYMax = ref(0)

  return { scrollY, scrollYSpeed, scrollYMax }
})
