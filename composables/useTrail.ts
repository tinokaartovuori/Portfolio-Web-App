import { onMounted, type Ref } from 'vue'
import { onFrame, useFrame } from '~/composables/useFrameLoop'
import { scrollFrame } from '~/composables/useSmoothScroll'
import { Spring } from '~/utils/spring'
import { ScrollFeel } from '~/utils/scrollFeel'
import { motion } from '~/motion.config'

/**
 * The page-wide trail, in screen px: how far behind its scroll position the
 * page's body currently is. Positive when the content trails below its box,
 * i.e. while scrolling down. Plain and non-reactive, like `scrollFrame`.
 */
export const trailFrame = { y: 0 }

let started = false

/*
 * One spring for the whole page, the same one the images use, integrated
 * once per frame in the transform stage. Every trailed element reads it, so
 * text, rules and shapes lag together and settle together.
 */
function start() {
  if (started) return
  started = true
  const feel = new ScrollFeel(motion.scrollFeel)
  const spring = new Spring(motion.image.lag)
  onFrame('transform', (dt) => {
    if (scrollFrame.reduced) {
      trailFrame.y = 0
      return
    }
    feel.update(scrollFrame.velocity, dt)
    spring.target = motion.image.lag.max * feel.drive
    trailFrame.y = spring.update(dt)
  })
}

/**
 * Makes an element trail its scroll position like the images do, by
 * `share` of the page trail. The write is a transform, so a mesh pinned to
 * the element (or to a child of it) follows for free by measuring it.
 */
export function useTrail(target: Ref<HTMLElement | null>, share = 1) {
  let element: HTMLElement | null = null
  let last = Number.NaN

  onMounted(start)

  useFrame('render', () => {
    const node = target.value
    if (!node) return
    if (node !== element) {
      element = node
      last = Number.NaN
    }
    const y = Math.round(trailFrame.y * share * 10) / 10
    if (y === last) return
    last = y
    node.style.transform = `translate3d(0, ${y}px, 0)`
  })
}
