<template>
  <!--
    The row above each project: a wireframe solid drawn by the WebGL layer in
    the box, a rule that draws itself as the row enters the viewport, and the
    number. The solid alternates sides down the list (`flip`): on wide
    screens that puts it opposite the image. Decorative — the list itself
    carries the order — so it is hidden from assistive technology.
  -->
  <div
    ref="row"
    aria-hidden="true"
    class="mb-8 flex items-center gap-5 will-change-transform md:mb-10 md:gap-8"
    :class="flip ? 'flex-row-reverse' : ''"
  >
    <ElementTracker
      :threeReference="threeReference"
      object="WireShape"
      :variant="shape"
    >
      <div class="h-8 w-8 md:h-14 md:w-14"></div>
    </ElementTracker>
    <span
      ref="rule"
      class="index-rule h-px flex-1 bg-onyx/30 dark:bg-platinum/30"
      :class="flip ? 'origin-right' : 'origin-left'"
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
import { useTrail } from '~/composables/useTrail'
import { motion } from '~/motion.config'
import type { WireShapeName } from '~/components/three-components/WireShape'

const props = defineProps<{
  index: number
  /** Unique across every tracker on the page; see ElementTracker. */
  threeReference: string
  /** Put the solid on the right. */
  flip?: boolean
}>()

const config = motion.index

const SHAPES: WireShapeName[] = ['cube', 'pyramid', 'octahedron', 'globe']
const shape = computed(() => SHAPES[props.index % SHAPES.length])

const row = ref<HTMLElement | null>(null)
const rule = ref<HTMLElement | null>(null)

// The whole row rides the page trail; the shape follows by measuring its box
useTrail(row, motion.trail.index)

let reduced = false
let setScale: ((value: number) => void) | null = null
let progress = 0
let lastScale = -1

onMounted(() => {
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})

useFrame('render', (dt) => {
  if (reduced || !row.value || !rule.value) return
  if (!setScale) {
    setScale = gsap.quickSetter(rule.value, 'scaleX') as (v: number) => void
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
})
</script>

<style scoped>
.index-rule {
  will-change: transform;
}
</style>
