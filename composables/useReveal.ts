import { onFrame } from '~/composables/useFrameLoop'
import { scrollFrame } from '~/composables/useSmoothScroll'
import { motion } from '~/motion.config'

/**
 * The two reveal clocks, plain and non-reactive like `trailFrame`: linear
 * 0..1, advanced once per frame in the transform stage once started.
 *
 * `page` starts on the first client frame and is what the DOM-side pieces that
 * cannot be right in the server HTML (the scroll track's indicator, the grain)
 * fade in on. `scene` starts the frame after the WebGL layer has drawn its
 * first frame and the hero has been measured, and is what scene-wide effects
 * (the dust) fade in on. Element-bound meshes run their own `Arrival` clock
 * and read `scene` only as "the scene has rendered".
 *
 * Consumers shape the clock with `ease`; the clocks themselves stay linear so
 * one number says how far along the reveal is.
 */
export const revealFrame = { page: 0, scene: 0 }

/** Smoothstep: symmetric, zero slope at both ends, a definite end. */
export const ease = (t: number) => t * t * (3 - 2 * t)

let pageStarted = false
let sceneStarted = false
let integrating = false

function integrate() {
  if (integrating || import.meta.server) return
  integrating = true
  onFrame('transform', (dt) => {
    if (scrollFrame.reduced) {
      if (pageStarted) revealFrame.page = 1
      if (sceneStarted) revealFrame.scene = 1
      return
    }
    if (pageStarted && revealFrame.page < 1)
      revealFrame.page = Math.min(1, revealFrame.page + dt / motion.reveal.page)
    if (sceneStarted && revealFrame.scene < 1)
      revealFrame.scene = Math.min(
        1,
        revealFrame.scene + dt / motion.reveal.scene,
      )
  })
}

/** Starts the page clock. Idempotent; call from any `onMounted`. */
export function startPageReveal() {
  if (pageStarted) return
  pageStarted = true
  integrate()
}

/** Starts the scene clock. Idempotent; the canvas calls it after its first render. */
export function startSceneReveal() {
  if (sceneStarted) return
  sceneStarted = true
  integrate()
}

/** True once the scene clock has been started (the scene has drawn a frame). */
export function sceneRevealStarted() {
  return sceneStarted
}
