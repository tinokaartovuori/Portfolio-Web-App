<template>
  <!--
    The row above each project: a large outlined numeral and a rule that
    draws itself as the row enters the viewport. Decorative — the list itself
    carries the order — so it is hidden from assistive technology.
  -->
  <div ref="row" aria-hidden="true" class="mb-8 flex items-end gap-6 md:mb-10">
    <span
      ref="numeral"
      class="index-numeral leading-none font-light tracking-tight text-onyx select-none dark:text-platinum"
    >
      {{ String(index + 1).padStart(2, '0') }}
    </span>
    <span
      ref="rule"
      class="index-rule mb-3 h-px flex-1 origin-left bg-onyx/30 dark:bg-platinum/30"
    ></span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { gsap } from 'gsap'
import { useFrame, damp } from '~/composables/useFrameLoop'
import { motion } from '~/motion.config'

defineProps<{ index: number }>()

const config = motion.index

const row = ref<HTMLElement | null>(null)
const numeral = ref<HTMLElement | null>(null)
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
  if (reduced || !row.value || !numeral.value || !rule.value) return
  if (!setScale || !setY) {
    setScale = gsap.quickSetter(rule.value, 'scaleX') as (v: number) => void
    setY = gsap.quickSetter(numeral.value, 'y', 'px') as (v: number) => void
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
/*
 * Hollow glyphs: the fill goes, the stroke stays on the text colour, which is
 * the animated `color` and so rides the global theme transition.
 */
.index-numeral {
  font-size: clamp(3.5rem, 9vw, 8rem);
  -webkit-text-stroke: 1px currentColor;
  -webkit-text-fill-color: transparent;
  opacity: 0.22;
  will-change: transform;
}

.index-rule {
  will-change: transform;
}
</style>
