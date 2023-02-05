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
import { RoundedRectangleShape } from './three-components/RoundedRectangleShape'

const appStateStore = useAppStateStore()
const { scrollY } = storeToRefs(appStateStore) // Pinia store value for scrollY

const { width, height } = useWindowSize()
const aspectRatio = computed(() => width.value / height.value)
const threeCanvas: Ref<HTMLCanvasElement | null> = ref(null)
let scenario: Scenario

const roundedRectShape = new RoundedRectangleShape(
  0,
  0,
  width.value - 50,
  height.value - 50,
  25,
)
const roundedRectGeometry = new ShapeGeometry(roundedRectShape)
const roundedRectMaterial = new MeshBasicMaterial({
  color: 0x444444,
  // wireframe: true,
})
const roundedRect = new Mesh(roundedRectGeometry, roundedRectMaterial)

onMounted(() => {
  if (!threeCanvas.value) return

  // Create a new scenario (scene, camera, renderer)
  scenario = new Scenario(threeCanvas.value)

  // Adding the stuff to the scene
  scenario.scene.add(roundedRect)

  loop() // Start the animation loop
})

watch(aspectRatio, () => {
  if (!threeCanvas.value) return
  scenario.updateCameraSize(width.value, height.value)
  scenario.updateRendererSize(width.value, height.value)
})

const loop = () => {
  requestAnimationFrame(loop)

  roundedRect.position.y = scrollY.value
  scenario.render() // Render the scene
}
</script>
