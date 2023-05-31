<template>
  <div class="absolute bottom-0 left-0 right-0 top-0 bg-platinum dark:bg-onyx">
    <canvas ref="threeCanvas" class="absolute bottom-0 left-0 right-0 top-0" />
  </div>
</template>

<script setup lang="ts">
import Scenario from './three-components/Scenario'
import ImageManager from './three-components/ImageManager'
import ElementManager from './three-components/ElementManager'

import { Ref, getCurrentInstance } from 'vue'
import { storeToRefs } from 'pinia'

import { useThreeObjectStateStore } from '~/store/threeObjectState'
import { useScrollStateStore } from '~/store/scrollState'
import { useWindowSize } from '@vueuse/core'

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
let elementManager: ElementManager

onMounted(() => {
  if (!threeCanvas.value) return

  scenario = new Scenario(threeCanvas.value)
  imageManager = new ImageManager(scenario.scene)
  elementManager = new ElementManager(scenario.scene)

  imageManager.loadImages(threeImageTracker.value)
  elementManager.loadElements(threeElementTracker.value)
  loop() // Start the animation loop
})

watch(aspectRatio, () => {
  if (!threeCanvas.value) return
  imageManager.updateImages(scrollYSpeed.value)
  elementManager.updateElements()

  scenario.updateCameraSize(width.value, height.value)
  scenario.updateRendererSize(width.value, height.value)
})

watch(scrollY, () => {
  imageManager.updateImages(scrollYSpeed.value)
  elementManager.updateElementPositions()
})

watch(threeObjectState, () => {
  forceUpdate()
  imageManager.removeImages()
  elementManager.removeElements()
  imageManager.loadImages(threeImageTracker.value)
  elementManager.loadElements(threeElementTracker.value)
})

function forceUpdate() {
  const instance = getCurrentInstance()
  if (instance) {
    instance.proxy?.$forceUpdate()
  }
}

const loop = () => {
  requestAnimationFrame(loop)

  scenario.render() // Render the scene
}
</script>
