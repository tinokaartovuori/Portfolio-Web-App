<template>
  <div>
    <canvas
      ref="threeCanvas"
      class="absolute top-0 bottom-0 left-0 right-0 bg-white dark:bg-black"
    />
  </div>
</template>

<script setup lang="ts">
import { Scene, OrthographicCamera, WebGLRenderer } from 'three'
import { Ref } from 'vue'
import { storeToRefs } from 'pinia'

import { useAppStateStore } from '~/store/appState'
import { useWindowSize } from '@vueuse/core'
import { RoundedRectangle } from './three-components/RoundedRectangle'

const appStateStore = useAppStateStore()
const { scrollY } = storeToRefs(appStateStore) // Pinia store value for scrollY

let renderer: WebGLRenderer
const threeCanvas: Ref<HTMLCanvasElement | null> = ref(null)

const { width, height } = useWindowSize()
const aspectRatio = computed(() => width.value / height.value)

const scene = new Scene()

const camera = new OrthographicCamera(
  -width.value / 2,
  width.value / 2,
  height.value / 2,
  -height.value / 2,
  1,
  1000,
)
camera.position.set(0, 0, 100)

scene.add(camera)

// scene.add(sphere)
const introRect = new RoundedRectangle(0, 0, width.value, height.value, 25)
introRect.position.set(0, 0, 0)
scene.add(introRect)

function updateCamera() {
  camera.left = -width.value / 2
  camera.right = width.value / 2
  camera.top = height.value / 2
  camera.bottom = -height.value / 2

  camera.updateProjectionMatrix()
}

function updateRenderer() {
  renderer.setSize(width.value, height.value)
  renderer.render(scene, camera)
}

function setRenderer() {
  if (threeCanvas.value) {
    renderer = new WebGLRenderer({ canvas: threeCanvas.value })
    renderer.setClearColor(0xffffff, 0)
    updateRenderer()
  }
}

watch(aspectRatio, () => {
  updateCamera()
  updateRenderer()
  introRect.updateShape(width.value, height.value)
})

onMounted(() => {
  setRenderer()
  loop()
})

const loop = () => {
  introRect.position.y = scrollY.value

  updateRenderer()
  requestAnimationFrame(loop)
}
</script>
