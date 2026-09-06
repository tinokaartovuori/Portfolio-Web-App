import type { scrollFrame } from '~/composables/useSmoothScroll'
import type { pointerFrame } from '~/composables/usePointer'

/**
 * Everything a mesh may want to know about the frame it is being updated for.
 * One object is built by ThreeScrollCanvas and reused every frame, so a mesh
 * update allocates nothing.
 */
export interface FrameContext {
  /** Seconds since the previous frame, clamped by the frame loop. */
  dt: number
  /** Seconds since the frame loop started. */
  time: number
  scroll: typeof scrollFrame
  pointer: typeof pointerFrame
  /**
   * `prefers-reduced-motion: reduce`. Meshes then sit exactly on their DOM
   * boxes: no lag, no bend, no float, no hover physics.
   */
  reduced: boolean
  /**
   * The colour theme, 0 for light and 1 for dark, damped between the two over
   * the same ~600ms the CSS colour transition takes — so a mesh that blends
   * two palettes by it fades along with the page rather than snapping.
   */
  theme: number
  /**
   * The hero's height on the current page in px (from the scroll store): 0
   * on a page without one, Infinity until the page has measured it. The
   * backdrop's lights come on as the hero scrolls away.
   */
  heroHeight: number
  /**
   * True once the scene has drawn at least one frame. Until then nothing may
   * hide or fade the DOM version of what it draws (the CSS plates, the
   * `<img>`s): the page is what the visitor sees.
   */
  rendered: boolean
  /**
   * The scene's reveal, 0..1: starts the frame after the first render once
   * the hero is measured, and climbs over `motion.reveal.scene`. Scene-wide
   * effects (the dust) fade in on it; element-bound meshes run their own
   * arrival clock (Arrival.ts) instead.
   */
  reveal: number
}
