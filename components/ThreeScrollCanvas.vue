<template>
  <div class="dark:bg-onyx bg-platinum absolute top-0 bottom-0 left-0 right-0">
    <canvas ref="threeCanvas" class="absolute top-0 bottom-0 left-0 right-0" />
  </div>
</template>

<script setup lang="ts">
// For testing purposes
import { SphereGeometry, MeshBasicMaterial, Mesh } from 'three'

import Scenario from './three-components/Scenario'
import ThreeDomSyncer from './three-components/ThreeDomSyncer'
import WavyImage from './three-components/WavyImage'

import { Ref } from 'vue'
import { storeToRefs } from 'pinia'

import { useAppStateStore } from '~/store/appState'
import { useWindowSize } from '@vueuse/core'
import { IntroRectangle } from './three-components/IntroRectangle'

const appStateStore = useAppStateStore()
const { domElementTracker, threeImageTracker, scrollYSpeed, scrollY } =
  storeToRefs(appStateStore)

const { width, height } = useWindowSize()
const aspectRatio = computed(() => width.value / height.value)
const threeCanvas: Ref<HTMLCanvasElement | null> = ref(null)

// Scenario: a scene, a camera and a renderer
let scenario: Scenario

let wavyImages = [] as WavyImage[]

// Intro Rectangle
const introRectangle = new IntroRectangle(width.value, height.value)
// Adding a syncer to the intro rectangle
const introRectangleSyncer = new ThreeDomSyncer(
  'centered',
  introRectangle as any,
  domElementTracker.value['homeIntro'] as HTMLElement,
)

// Making a test sphere
const geometry = new SphereGeometry(1, 32, 32)
// Glowing red material
const material = new MeshBasicMaterial({
  color: 0xff0000,
  transparent: true,
  opacity: 0.5,
  wireframe: true,
})
const sphere = new Mesh(geometry, material)
const sphereSyncer = new ThreeDomSyncer(
  'centered-fit',
  sphere,
  domElementTracker.value['testSection2'] as HTMLElement,
)

onMounted(() => {
  if (!threeCanvas.value) return

  scenario = new Scenario(threeCanvas.value)

  // Creating image meshes
  for (const [key, imageElement] of Object.entries(threeImageTracker.value)) {
    const wavyImage = new WavyImage(imageElement as HTMLImageElement)
    wavyImages.push(wavyImage)
    scenario.scene.add(wavyImage)
    wavyImage.update(scrollYSpeed.value)
  }

  // Adding stuff to the scene
  scenario.scene.add(introRectangle)
  scenario.scene.add(sphere)

  loop() // Start the animation loop
})

watch(aspectRatio, () => {
  if (!threeCanvas.value) return

  introRectangle.updateShape(width.value, height.value)
  wavyImages.forEach((image) => image.update(scrollYSpeed.value))

  scenario.updateCameraSize(width.value, height.value)
  scenario.updateRendererSize(width.value, height.value)
})

watch(scrollY, () => {
  wavyImages.forEach((image) => image.update(scrollYSpeed.value))
})

const loop = () => {
  requestAnimationFrame(loop)
  // Syncing the introRectangle with the domElementTracker
  introRectangleSyncer.sync()
  sphereSyncer.sync()

  scenario.render() // Render the scene
}
</script>
