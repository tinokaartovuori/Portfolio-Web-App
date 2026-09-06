<!--
  The grain over the page: a fixed canvas of grey noise laid over everything,
  the WebGL canvas and the text alike, so the whole site has one surface.

  Drawn once as a tile of random grey and shown through a small canvas that
  is scaled up unfiltered to the viewport, one grain per `motion.noise.grain`
  CSS px. It is re-rolled at `motion.noise.rate` by drawing the tile at a new
  offset (wrapped, so the seams are between two random regions and invisible),
  which costs four blits and no random numbers. Plain alpha over the page, no
  blend mode: an overlay blend was tried and its amplitude follows the base —
  strongest in the photographs' mid-tones, nearly nothing on the page colour —
  which is the wrong way round. The grey lifts the dark page by a few levels
  at this opacity, the same as on the site this is modelled on.

  A full-viewport grain was tried once before and taken out: that one tiled a
  small texture and stepped it a few times a second, which read as a moving
  grid. This one does not tile within the viewport and re-rolls slowly.
-->
<template>
  <canvas
    ref="canvas"
    class="noise pointer-events-none fixed inset-0 z-[60] h-full w-full"
    style="opacity: 0"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { onFrame } from '~/composables/useFrameLoop'
import { revealFrame, ease, startPageReveal } from '~/composables/useReveal'
import { motion } from '~/motion.config'

const config = motion.noise

/** The random tile, px a side. The shown canvas never exceeds it. */
const TILE = 1024

const canvas = ref<HTMLCanvasElement | null>(null)
const colorMode = useColorMode()

/*
 * The opacity follows the theme (the step between the two is too small to
 * need smoothing) and comes up on the page's reveal envelope, written from
 * the frame loop. Off in the server HTML: the server does not know the
 * theme, and the envelope starts on the first client frame anyway.
 */
let lastOpacity = Number.NaN

let stopFrame: (() => void) | null = null
let stopResize: (() => void) | null = null

onMounted(() => {
  startPageReveal()
  const target = canvas.value
  if (!target) return
  const ctx = target.getContext('2d', { alpha: false })
  if (!ctx) return

  // The tile: one grey per pixel, once
  const tile = document.createElement('canvas')
  tile.width = TILE
  tile.height = TILE
  const tileCtx = tile.getContext('2d')
  if (!tileCtx) return
  const image = tileCtx.createImageData(TILE, TILE)
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    const grey = (Math.random() * 256) | 0
    data[i] = grey
    data[i + 1] = grey
    data[i + 2] = grey
    data[i + 3] = 255
  }
  tileCtx.putImageData(image, 0, 0)

  const fit = () => {
    target.width = Math.min(TILE, Math.ceil(window.innerWidth / config.grain))
    target.height = Math.min(TILE, Math.ceil(window.innerHeight / config.grain))
  }

  // The tile at an offset, wrapped: up to four blits cover the canvas
  const roll = () => {
    const { width, height } = target
    const ox = (Math.random() * TILE) | 0
    const oy = (Math.random() * TILE) | 0
    for (let y = -oy; y < height; y += TILE) {
      for (let x = -ox; x < width; x += TILE) {
        ctx.drawImage(tile, x, y)
      }
    }
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  let rolled = -1

  fit()
  roll()

  // Re-rolled at the grain's own rate; still under reduced motion
  stopFrame = onFrame('render', (_dt, time) => {
    const alpha = colorMode.value === 'dark' ? config.alpha[1] : config.alpha[0]
    const opacity = Math.round(alpha * ease(revealFrame.page) * 1000) / 1000
    if (opacity !== lastOpacity) {
      lastOpacity = opacity
      target.style.opacity = String(opacity)
    }
    if (reduced.matches) return
    const tick = Math.floor(time * config.rate)
    if (tick === rolled) return
    rolled = tick
    roll()
  })

  const onResize = () => {
    fit()
    roll()
  }
  window.addEventListener('resize', onResize, { passive: true })
  stopResize = () => window.removeEventListener('resize', onResize)
})

onUnmounted(() => {
  stopFrame?.()
  stopFrame = null
  stopResize?.()
  stopResize = null
})
</script>

<style scoped>
.noise {
  image-rendering: pixelated;
}
</style>
