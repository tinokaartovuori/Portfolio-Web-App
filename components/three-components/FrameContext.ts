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
}
