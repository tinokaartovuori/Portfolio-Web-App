<template>
  <div class="absolute top-0 bottom-0 left-0 right-0 dark:bg-onyx bg-white">
    <canvas ref="threeCanvas" class="absolute top-0 bottom-0 left-0 right-0" />
  </div>
</template>

<script setup lang="ts">
import { Mesh, MeshBasicMaterial, SphereGeometry, ShapeGeometry } from 'three'

import Scenario from './three-components/Scenario'

import { Ref } from 'vue'
import { storeToRefs } from 'pinia'

import { useAppStateStore } from '~/store/appState'
import { useWindowSize } from '@vueuse/core'
import { IntroRectangle } from './three-components/IntroRectangle'

const appStateStore = useAppStateStore()
const { scrollY } = storeToRefs(appStateStore) // Pinia store value for scrollY

const { width, height } = useWindowSize()
const aspectRatio = computed(() => width.value / height.value)
const threeCanvas: Ref<HTMLCanvasElement | null> = ref(null)

// Scenario: a scene, a camera and a renderer
let scenario: Scenario

const roundedRect = new IntroRectangle(width.value, height.value)

onMounted(() => {
  if (!threeCanvas.value) return

  scenario = new Scenario(threeCanvas.value)

  // Adding stuff to the scene
  scenario.scene.add(roundedRect)

  loop() // Start the animation loop
})

watch(aspectRatio, () => {
  if (!threeCanvas.value) return

  roundedRect.updateShape(width.value, height.value)

  scenario.updateCameraSize(width.value, height.value)
  scenario.updateRendererSize(width.value, height.value)
})

const loop = () => {
  requestAnimationFrame(loop)

  roundedRect.position.y = scrollY.value
  scenario.render() // Render the scene
}
</script>
