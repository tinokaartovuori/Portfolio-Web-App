import { onMounted, type Ref } from 'vue'
import { useFrame } from '~/composables/useFrameLoop'
import { pointerFrame } from '~/composables/usePointer'
import { Spring } from '~/utils/spring'
import { motion } from '~/motion.config'

export interface MagneticOptions {
  /** How far outside the element's box the pull starts, px. */
  radius?: number
  /** Share of the pointer's offset from the centre the element moves by. */
  strength?: number
}

/**
 * Pulls an element toward the pointer while it is near, and lets it spring
 * back when it leaves. Fine pointers only, off under reduced motion.
 *
 * The element is translated, so its measured box moves with it; the pull is
 * computed from where the box would be at rest, or the element would chase
 * its own displacement.
 */
export function useMagnetic(
  target: Ref<HTMLElement | null>,
  options: MagneticOptions = {},
) {
  const config = motion.magnetic
  const radius = options.radius ?? config.radius
  const strength = options.strength ?? config.strength

  const springX = new Spring(config.spring)
  const springY = new Spring(config.spring)

  let enabled = false
  let element: HTMLElement | null = null
  let atRest = true
  let lastX = Number.NaN
  let lastY = Number.NaN

  const write = (el: HTMLElement, x: number, y: number) => {
    // Hundredths of a px: finer than anything a screen shows, coarse enough
    // that a settling spring stops writing before it stops moving
    const rx = Math.round(x * 100) / 100
    const ry = Math.round(y * 100) / 100
    if (rx === lastX && ry === lastY) return
    lastX = rx
    lastY = ry
    el.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
  }

  onMounted(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    enabled = fine && !reduced
  })

  useFrame('render', (dt) => {
    if (!enabled) return
    const el = target.value
    if (!el) return
    if (el !== element) {
      element = el
      lastX = Number.NaN
      lastY = Number.NaN
    }

    let pullX = 0
    let pullY = 0
    if (pointerFrame.active) {
      const rect = el.getBoundingClientRect()
      // The rect includes the current translation; take it back out
      const centerX = rect.left + rect.width / 2 - springX.value
      const centerY = rect.top + rect.height / 2 - springY.value
      const dx = pointerFrame.x - centerX
      const dy = pointerFrame.y - centerY
      if (
        Math.abs(dx) < rect.width / 2 + radius &&
        Math.abs(dy) < rect.height / 2 + radius
      ) {
        pullX = dx * strength
        pullY = dy * strength
      }
    }

    springX.target = pullX
    springY.target = pullY

    // Nothing to do for an idle element: no spring step, no style write
    if (pullX === 0 && pullY === 0 && springX.settled && springY.settled) {
      if (!atRest) {
        atRest = true
        write(el, 0, 0)
      }
      return
    }

    atRest = false
    springX.update(dt)
    springY.update(dt)
    write(el, springX.value, springY.value)
  })
}
