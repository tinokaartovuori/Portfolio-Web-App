import Lenis from 'lenis'
import { onFrame } from './useFrameLoop'

/**
 * Plain, non-reactive frame state.
 *
 * The WebGL layer reads this directly instead of the Pinia store: it is
 * rewritten every frame, and pushing that through Vue's reactivity to trigger
 * mesh updates is what previously made the meshes advance only when a watcher
 * happened to fire — so the deformation froze mid-decay whenever scrolling
 * stopped, instead of relaxing back to rest.
 */
export const scrollFrame = {
  /** Smoothed scroll offset in pixels. */
  y: 0,
  /** Velocity in pixels per second. */
  velocity: 0,
  /** Maximum scrollable offset in pixels. */
  max: 0,
}

/**
 * How fast the smoothing catches up, as a Lenis `lerp`.
 *
 * Lenis multiplies this by 60 and feeds it to a delta-time-corrected decay, so
 * unlike the old scrollbar the feel is identical at 60, 120 and 144Hz.
 * 0.15 settles to within 1% in roughly half a second.
 */
const LERP = 0.15

export interface SmoothScroll {
  lenis: Lenis
  destroy: () => void
}

export function createSmoothScroll(): SmoothScroll {
  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches

  const lenis = new Lenis({
    // The frame loop drives this, so scroll, mesh transforms and the WebGL draw
    // cannot desync
    autoRaf: false,
    // lerp 1 is "no smoothing", i.e. plain native scrolling
    lerp: reducedMotion ? 1 : LERP,
    smoothWheel: !reducedMotion,
    // Left as native scrolling: it stays on the compositor, which is both
    // smoother and cheaper on battery than synthesising touch momentum
    syncTouch: false,
  })

  let previousY = lenis.scroll

  const stopFrame = onFrame('scroll', (dt, time) => {
    lenis.raf(time * 1000)

    const y = lenis.scroll
    // Pixels per second, not pixels per frame
    scrollFrame.velocity = dt > 0 ? (y - previousY) / dt : 0
    previousY = y
    scrollFrame.y = y
    scrollFrame.max = lenis.limit
  })

  return {
    lenis,
    destroy: () => {
      stopFrame()
      lenis.destroy()
      scrollFrame.y = 0
      scrollFrame.velocity = 0
      scrollFrame.max = 0
    },
  }
}
