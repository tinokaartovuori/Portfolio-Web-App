<template>
  <div class="absolute bottom-0 left-0 right-0 top-0 bg-platinum dark:bg-onyx">
    <canvas ref="threeCanvas" class="absolute bottom-0 left-0 right-0 top-0" />
  </div>
</template>

<script setup lang="ts">
import Scenario from './three-components/Scenario'
import ImageManager from './three-components/ImageManager'
import ElementManager from './three-components/ElementManager'

import { Ref } from 'vue'
import { storeToRefs } from 'pinia'

import { useThreeObjectStateStore } from '~/store/threeObjectState'
import { useScrollStateStore } from '~/store/scrollState'
import { useWindowSize } from '@vueuse/core'

// Trailing debounce for window resizes, so a drag only rebuilds once it settles
const resizeDebounce = 100

const threeObjectState = useThreeObjectStateStore()
const scrollState = useScrollStateStore()

const { threeElementTracker, threeImageTracker } = storeToRefs(threeObjectState)
const { scrollY, scrollYSpeed } = storeToRefs(scrollState)

const { width, height } = useWindowSize()
const threeCanvas: Ref<HTMLCanvasElement | null> = ref(null)

// Scenario: a scene, a camera and a renderer
let scenario: Scenario | null = null
let imageManager: ImageManager | null = null
let elementManager: ElementManager | null = null

let frameId: number | null = null
let resizeTimeout: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  if (!threeCanvas.value) return

  scenario = new Scenario(threeCanvas.value)
  imageManager = new ImageManager(scenario.scene)
  elementManager = new ElementManager(scenario.scene)

  imageManager.loadImages(threeImageTracker.value)
  elementManager.loadElements(threeElementTracker.value)
  loop() // Start the animation loop
})

onUnmounted(() => {
  if (frameId !== null) {
    cancelAnimationFrame(frameId)
    frameId = null
  }

  if (resizeTimeout !== null) {
    clearTimeout(resizeTimeout)
    resizeTimeout = null
  }

  imageManager?.removeImages()
  elementManager?.removeElements()
  scenario?.renderer.dispose()

  // Nulling these also stops the animation loop from picking up another frame
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

watch(scrollY, () => {
  if (!imageManager || !elementManager) return

  imageManager.updateImages(scrollYSpeed.value)
  elementManager.updateElementPositions()
})

watch(threeObjectState, () => {
  if (!imageManager || !elementManager) return

  imageManager.removeImages()
  elementManager.removeElements()
  imageManager.loadImages(threeImageTracker.value)
  elementManager.loadElements(threeElementTracker.value)
})

const resize = () => {
  if (!scenario || !imageManager || !elementManager) return

  imageManager.updateImages(scrollYSpeed.value)
  elementManager.updateElements()

  scenario.updateCameraSize(width.value, height.value)
  scenario.updateRendererSize(width.value, height.value)
}

const loop = () => {
  if (!scenario) return

  frameId = requestAnimationFrame(loop)

  scenario.render() // Render the scene
}
</script>
