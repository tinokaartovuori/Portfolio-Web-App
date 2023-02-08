<template>
  <div class="dark:bg-onyx bg-platinum absolute top-0 bottom-0 left-0 right-0">
    <canvas ref="threeCanvas" class="absolute top-0 bottom-0 left-0 right-0" />
  </div>
</template>

<script setup lang="ts">
import Scenario from './three-components/Scenario'
import ImageManager from './three-components/ImageManager'

import { Ref } from 'vue'
import { storeToRefs } from 'pinia'

import { useThreeObjectStateStore } from '~/store/threeObjectState'
import { useScrollStateStore } from '~/store/scrollState'
import { useWindowSize } from '@vueuse/core'
import { IntroRectangle } from './three-components/IntroRectangle'

const threeObjectState = useThreeObjectStateStore()
const scrollState = useScrollStateStore()

const { threeElementTracker, threeImageTracker } = storeToRefs(threeObjectState)
const { scrollY, scrollYSpeed } = storeToRefs(scrollState)

const { width, height } = useWindowSize()
const aspectRatio = computed(() => width.value / height.value)
const threeCanvas: Ref<HTMLCanvasElement | null> = ref(null)

// Scenario: a scene, a camera and a renderer
let scenario: Scenario
let imageManager: ImageManager

onMounted(() => {
  if (!threeCanvas.value) return

  scenario = new Scenario(threeCanvas.value)
  imageManager = new ImageManager(scenario.scene)
  imageManager.loadImages(threeImageTracker.value)
  loop() // Start the animation loop
})

watch(aspectRatio, () => {
  if (!threeCanvas.value) return
  imageManager.updateImages(scrollYSpeed.value)
  scenario.updateCameraSize(width.value, height.value)
  scenario.updateRendererSize(width.value, height.value)
})

watch(scrollY, () => {
  imageManager.updateImages(scrollYSpeed.value)
})

watch(threeObjectState, () => {
  imageManager.removeImages()
  imageManager.loadImages(threeImageTracker.value)
})

const loop = () => {
  requestAnimationFrame(loop)
  scenario.render() // Render the scene
}
</script>
