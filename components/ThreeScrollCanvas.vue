<template>
  <div class="fixed inset-0 z-0 bg-platinum dark:bg-onyx">
    <canvas ref="threeCanvas" class="absolute inset-0" aria-hidden="true" />
  </div>
</template>

<script setup lang="ts">
import Scenario from './three-components/Scenario'
import ImageManager from './three-components/ImageManager'
import ElementManager from './three-components/ElementManager'

import type { Ref } from 'vue'
import { storeToRefs } from 'pinia'

import { useThreeObjectStateStore } from '~/store/threeObjectState'
import { useWindowSize } from '@vueuse/core'
import { onFrame } from '~/composables/useFrameLoop'
import { scrollFrame } from '~/composables/useSmoothScroll'

// Trailing debounce for window resizes, so a drag only rebuilds once it settles
const resizeDebounce = 100

const threeObjectState = useThreeObjectStateStore()
const { threeElementTracker, threeImageTracker } = storeToRefs(threeObjectState)

const { width, height } = useWindowSize()
const threeCanvas: Ref<HTMLCanvasElement | null> = ref(null)

// Scenario: a scene, a camera and a renderer
let scenario: Scenario | null = null
let imageManager: ImageManager | null = null
let elementManager: ElementManager | null = null

let resizeTimeout: ReturnType<typeof setTimeout> | null = null
let rebuildQueued = false
let torndown = false
const stopFrame: Array<() => void> = []

onMounted(() => {
  if (!threeCanvas.value) return

  scenario = new Scenario(threeCanvas.value)
  imageManager = new ImageManager(scenario.scene)
  elementManager = new ElementManager(scenario.scene)

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
    onFrame('transform', (dt) => {
      if (!imageManager || !elementManager) return
      imageManager.updateImages(scrollFrame.velocity, dt)
      elementManager.updateElementPositions()
    }),
    onFrame('render', () => scenario?.render()),
  )
})

onUnmounted(() => {
  torndown = true

  for (const stop of stopFrame) stop()
  stopFrame.length = 0

  if (resizeTimeout !== null) {
    clearTimeout(resizeTimeout)
    resizeTimeout = null
  }

  imageManager?.removeImages()
  elementManager?.removeElements()
  scenario?.renderer.dispose()

  imageManager = null
  elementManager = null
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

  imageManager.updateImages(scrollFrame.velocity, 0)
  elementManager.updateElements()

  scenario.updateCameraSize(width.value, height.value)
  scenario.updateRendererSize(width.value, height.value)
}
</script>
