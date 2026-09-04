<template>
  <!--
    The row above each project: a wireframe solid drawn by the WebGL layer in
    the box on the left, a rule that draws itself as the row enters the
    viewport, and the number. Decorative — the list itself carries the order
    — so it is hidden from assistive technology.
  -->
  <div
    ref="row"
    aria-hidden="true"
    class="mb-8 flex items-center gap-6 md:mb-10 md:gap-8"
  >
    <ElementTracker
      :threeReference="threeReference"
      object="WireShape"
      :variant="shape"
    >
      <div
        ref="box"
        class="h-20 w-20 will-change-transform md:h-28 md:w-28"
      ></div>
    </ElementTracker>
    <span
      ref="rule"
      class="index-rule h-px flex-1 origin-left bg-onyx/30 dark:bg-platinum/30"
    ></span>
    <span
      class="font-mono text-xs tracking-[0.14em] text-onyx/45 dark:text-platinum/45"
    >
      {{ String(index + 1).padStart(2, '0') }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { gsap } from 'gsap'
import { useFrame, damp } from '~/composables/useFrameLoop'
import { motion } from '~/motion.config'
import type { WireShapeName } from '~/components/three-components/WireShape'

const props = defineProps<{
  index: number
  /** Unique across every tracker on the page; see ElementTracker. */
  threeReference: string
}>()

const config = motion.index

const SHAPES: WireShapeName[] = ['cube', 'pyramid', 'octahedron', 'icosahedron']
const shape = computed(() => SHAPES[props.index % SHAPES.length])

const row = ref<HTMLElement | null>(null)
const box = ref<HTMLElement | null>(null)
const rule = ref<HTMLElement | null>(null)

let reduced = false
let setScale: ((value: number) => void) | null = null
let setY: ((value: number) => void) | null = null
let progress = 0
let lastScale = -1
let lastY = Number.NaN

onMounted(() => {
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})

useFrame('render', (dt) => {
  if (reduced || !row.value || !box.value || !rule.value) return
  if (!setScale || !setY) {
    setScale = gsap.quickSetter(rule.value, 'scaleX') as (v: number) => void
    setY = gsap.quickSetter(box.value, 'y', 'px') as (v: number) => void
  }

  // Measure the row, not the rule: a rect includes the element's own
  // transform, and the rule's is exactly what is being set here
  const rect = row.value.getBoundingClientRect()
  const viewport = window.innerHeight

  const target = Math.min(
    1,
    Math.max(0, (viewport - rect.top) / (viewport * config.drawSpan)),
  )
  progress = damp(progress, target, config.drawSmoothing, dt)
  const scale = Math.abs(progress - target) < 0.001 ? target : progress
  if (scale !== lastScale) {
    lastScale = scale
    setScale(scale)
  }

  // The box moves and the mesh follows it, since the mesh measures the box
  const y = Math.round(
    (rect.top + rect.height / 2 - viewport / 2) * -config.parallax,
  )
  if (y !== lastY) {
    lastY = y
    setY(y)
  }
})
</script>

<style scoped>
.index-rule {
  will-change: transform;
}
</style>
