<template>
  <div
    ref="track"
    class="fixed bottom-0 right-0 top-0 z-40 w-0.5 bg-onyx/15 dark:bg-platinum/20 xs:w-1 sm:w-1.5"
  >
    <div
      ref="indicator"
      class="absolute right-0 top-0 w-0.5 rounded-full bg-pink-500 xs:w-1 sm:w-1.5"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { gsap } from 'gsap'
import { storeToRefs } from 'pinia'
import { useWindowSize } from '@vueuse/core'
import { useScrollStateStore } from '~/store/scrollState'
import { onFrame } from '~/composables/useFrameLoop'
const scrollStateStore = useScrollStateStore()
const { scrollY, scrollYMax } = storeToRefs(scrollStateStore)

const track = ref<HTMLElement | null>(null)
const indicator = ref<HTMLElement | null>(null)

const { height: windowHeight } = useWindowSize()

// Cached so the per frame update only has to write the indicator position
let trackHeight = 0
let indicatorHeight = 0
let setIndicatorY: ((value: number) => void) | null = null
let stopFrame: (() => void) | null = null

/* scrollYMax is 0 before the first scroll event and after every navigation,
 * so the indicator is collapsed instead of dividing by zero. */
const updateIndicatorHeight = () => {
  if (!track.value || !indicator.value) return
  trackHeight = track.value.clientHeight
  // Indicator height is ratio of track height to scrollYMax
  indicatorHeight =
    scrollYMax.value > 0
      ? ((trackHeight / scrollYMax.value) * trackHeight) / 2
      : 0
  gsap.set(indicator.value, { height: indicatorHeight })
}

const updateIndicatorPosition = () => {
  if (!setIndicatorY || scrollYMax.value <= 0) return
  const scrollYPercentage = scrollY.value / scrollYMax.value
  setIndicatorY(scrollYPercentage * (trackHeight - indicatorHeight))
}

watch([scrollYMax, windowHeight], () => {
  updateIndicatorHeight()
  updateIndicatorPosition()
})

onMounted(() => {
  if (indicator.value) {
    setIndicatorY = gsap.quickSetter(indicator.value, 'y', 'px') as (
      value: number,
    ) => void
  }
  updateIndicatorHeight()
  updateIndicatorPosition()
  // Runs in the shared frame loop's render stage, after scroll has advanced
  stopFrame = onFrame('render', updateIndicatorPosition)
})

onUnmounted(() => {
  stopFrame?.()
  stopFrame = null
})
</script>

<style scoped></style>
