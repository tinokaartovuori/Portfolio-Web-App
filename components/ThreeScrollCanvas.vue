<template>
  <canvas
    ref="canvas"
    class="absolute top-0 left-0 block h-full w-full bg-white dark:bg-black"
  ></canvas>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

// get the canvas element by ref 'canvas'
const canvas = ref<HTMLCanvasElement | null>(null)

// TODO: Use Three.js here to control the content in the canvas
// Now we are using the canvas API to draw a test

onMounted(() => {
  /* 
  TESTING CANVAS
  */
  if (!canvas.value) return
  let ctx: CanvasRenderingContext2D = canvas.value.getContext(
    '2d',
  ) as CanvasRenderingContext2D
  // Draw Test Stuff on the canvas

  // Set canvas size to match window size
  canvas.value.width = window.innerWidth
  canvas.value.height = window.innerHeight
  ctx.fillStyle = '#453d43'
  // draw a rectangle centered in the canvas
  ctx.fillRect(
    canvas.value.width / 2 - 500,
    canvas.value.height / 2 - 300,
    1000,
    600,
  )
  ctx.fillStyle = '#784d6f'
  // Write a text in the center of the rectangle
  ctx.font = '100px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('Test Canvas', canvas.value.width / 2, canvas.value.height / 2)
})
</script>

<style scoped>
canvas {
  position: absolute;
  height: 100%;
  width: 100%;
}
</style>
