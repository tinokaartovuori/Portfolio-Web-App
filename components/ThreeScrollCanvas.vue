<template>
  <div class="fixed inset-0 z-0 bg-platinum dark:bg-onyx">
    <canvas ref="threeCanvas" class="absolute inset-0" aria-hidden="true" />
  </div>
</template>

<script setup lang="ts">
import Scenario from './three-components/Scenario'
import ImageManager from './three-components/ImageManager'
import ElementManager from './three-components/ElementManager'
import LightCloud from './three-components/LightCloud'
import type { FrameContext } from './three-components/FrameContext'

import type { Ref } from 'vue'
import { storeToRefs } from 'pinia'

import { useThreeObjectStateStore } from '~/store/threeObjectState'
import { useWindowSize } from '@vueuse/core'
import { onFrame, damp } from '~/composables/useFrameLoop'
import { scrollFrame } from '~/composables/useSmoothScroll'
import { pointerFrame, createPointerTracker } from '~/composables/usePointer'
import { motion } from '~/motion.config'

// Trailing debounce for window resizes, so a drag only rebuilds once it settles
const resizeDebounce = 100

/*
 * Screen-space passes (bloom, blur, glass) go through an EffectComposer, which
 * costs a full-screen render target per frame and so stays off until a pass
 * needs it. Flip this and hand the passes to `enablePostProcessing`.
 */
const POST_PROCESSING = false

const threeObjectState = useThreeObjectStateStore()
const { threeElementTracker, threeImageTracker } = storeToRefs(threeObjectState)

const { width, height } = useWindowSize()
const threeCanvas: Ref<HTMLCanvasElement | null> = ref(null)

// The resolved theme ('light' | 'dark'); this component is client-only, so
// it is known by the time anything here runs
const colorMode = useColorMode()
const themeTarget = () => (colorMode.value === 'dark' ? 1 : 0)

// Scenario: a scene, a camera and a renderer
let scenario: Scenario | null = null
let imageManager: ImageManager | null = null
let elementManager: ElementManager | null = null
// The one thing in the scene not pinned to an element: depth, for its own sake
let lightCloud: LightCloud | null = null

let resizeTimeout: ReturnType<typeof setTimeout> | null = null
let rebuildQueued = false
let torndown = false
const stopFrame: Array<() => void> = []
let stopPointer: (() => void) | null = null

// One context object, reused every frame, so the update path allocates nothing
const frame: FrameContext = {
  dt: 0,
  time: 0,
  scroll: scrollFrame,
  pointer: pointerFrame,
  reduced: false,
  theme: 0,
}

onMounted(() => {
  if (!threeCanvas.value) return

  // Start on the current theme rather than fading in from the wrong one
  frame.theme = themeTarget()

  scenario = new Scenario(threeCanvas.value)
  if (POST_PROCESSING) scenario.enablePostProcessing()
  imageManager = new ImageManager(scenario.scene)
  elementManager = new ElementManager(scenario.scene)
  lightCloud = new LightCloud(scenario.scene)
  stopPointer = createPointerTracker()

  imageManager.loadImages(threeImageTracker.value)
  elementManager.loadElements(threeElementTracker.value)

  /*
   * Both stages run every frame, in this order, from the one shared clock.
   * They used to be a Vue watcher on scrollY and a private requestAnimationFrame
   * respectively — so mesh state only advanced when the scroll value changed
   * (freezing the deformation mid-decay the moment scrolling stopped) and the
   * draw could happen before or after the transform depending on mount order.
   */
  stopFrame.push(
    onFrame('transform', (dt, time) => {
      if (!imageManager || !elementManager) return
      frame.dt = dt
      frame.time = time
      frame.reduced = scrollFrame.reduced
      // Blend toward the theme over the same ~600ms the CSS colours take;
      // under reduced motion the CSS transition is 1ms, so snap to match
      const theme = themeTarget()
      frame.theme = frame.reduced
        ? theme
        : damp(frame.theme, theme, motion.theme.smoothing, dt)
      imageManager.updateImages(frame)
      elementManager.updateElementPositions(frame)
      lightCloud?.update(frame)
    }),
    onFrame('render', () => scenario?.render()),
  )
})

onUnmounted(() => {
  torndown = true

  for (const stop of stopFrame) stop()
  stopFrame.length = 0
  stopPointer?.()
  stopPointer = null

  if (resizeTimeout !== null) {
    clearTimeout(resizeTimeout)
    resizeTimeout = null
  }

  imageManager?.removeImages()
  elementManager?.removeElements()
  lightCloud?.dispose()
  scenario?.dispose()

  imageManager = null
  elementManager = null
  lightCloud = null
  scenario = null
})

// The renderer has to follow both dimensions: a resize that keeps the aspect
// ratio would otherwise leave every mesh measured against a stale viewport
watch([width, height], () => {
  if (resizeTimeout !== null) clearTimeout(resizeTimeout)

  resizeTimeout = setTimeout(() => {
    resizeTimeout = null
    resize()
  }, resizeDebounce)
})

/*
 * A rebuild drops every mesh and re-uploads every texture, so it must happen
 * once per burst rather than once per registration: trackers mount one after
 * the other (and asynchronously, once content arrives from a content layer),
 * and each of those lands as its own change on the registry.
 */
watch(threeObjectState, () => {
  if (rebuildQueued) return
  rebuildQueued = true

  nextTick(() => {
    rebuildQueued = false
    // nextTick callbacks cannot be cancelled, so a teardown between the
    // schedule and the flush has to be checked for here
    if (torndown) return
    if (!imageManager || !elementManager) return

    imageManager.removeImages()
    elementManager.removeElements()
    imageManager.loadImages(threeImageTracker.value)
    elementManager.loadElements(threeElementTracker.value)
  })
})

const resize = () => {
  if (!scenario || !imageManager || !elementManager) return

  imageManager.resizeImages()
  elementManager.updateElements()
  lightCloud?.resize()

  scenario.updateCameraSize(width.value, height.value)
  scenario.updateRendererSize(width.value, height.value)
}
</script>
