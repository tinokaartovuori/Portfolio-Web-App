<!--
  A frame-time meter for a device that cannot be profiled from the desk: add
  `?perf` to the address and scroll. Shown at the bottom left, in mono, and
  updated four times a second so it costs nothing itself. Read together with
  `?gl=0` (no WebGL at all) and `?dpr=1` (a lower pixel ratio) it says which
  layer the dropped frames belong to. Nothing here runs without the flag.
-->
<template>
  <pre
    ref="box"
    class="pointer-events-none fixed bottom-2 left-2 z-[70] m-0 rounded bg-black/70 px-2 py-1 font-mono text-[11px] leading-[1.35] text-white"
    aria-hidden="true"
  ></pre>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const box = ref<HTMLElement | null>(null)

let raf = 0
let last = 0
/** Frame durations of the last five seconds, ms */
const frames: number[] = []
let longest = 0
let nextWrite = 0

const percentile = (sorted: number[], q: number) =>
  sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]!
    : 0

function write(now: number) {
  const el = box.value
  if (!el) return
  const sorted = [...frames].sort((a, b) => a - b)
  const seconds = frames.reduce((a, b) => a + b, 0) / 1000
  const fps = seconds > 0 ? frames.length / seconds : 0
  const long = frames.filter((f) => f > 34).length
  const canvas = document.querySelector(
    'canvas.absolute',
  ) as HTMLCanvasElement | null
  const doc = document.documentElement
  const lines = [
    `fps ${fps.toFixed(0)}  p50 ${percentile(sorted, 0.5).toFixed(0)}  p90 ${percentile(sorted, 0.9).toFixed(0)}  max ${longest.toFixed(0)} ms`,
    `long frames (>34ms) in 5s: ${long}`,
    `dpr ${devicePixelRatio}  gl ${canvas ? `${canvas.width}x${canvas.height}` : 'off'}`,
    `width ${innerWidth}/${doc.scrollWidth}  scale ${(visualViewport?.scale ?? 1).toFixed(2)}`,
    `coarse ${matchMedia('(pointer: coarse)').matches ? 'yes' : 'no'}  scrollY ${Math.round(scrollY)}`,
  ]
  el.textContent = lines.join('\n')
  nextWrite = now + 250
}

function tick(now: number) {
  if (last) {
    const dt = now - last
    frames.push(dt)
    longest = Math.max(longest, dt)
    // Keep five seconds
    let total = 0
    for (let i = frames.length - 1; i >= 0; i--) {
      total += frames[i]!
      if (total > 5000) {
        frames.splice(0, i)
        break
      }
    }
  }
  last = now
  if (now >= nextWrite) {
    write(now)
    // The longest frame is reported per write, not for ever
    longest = 0
  }
  raf = requestAnimationFrame(tick)
}

onMounted(() => {
  raf = requestAnimationFrame(tick)
})
onUnmounted(() => cancelAnimationFrame(raf))
</script>
