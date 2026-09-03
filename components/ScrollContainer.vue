<template>
  <div class="relative z-10 w-full">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'

import { useScrollStateStore } from '~/store/scrollState'
import { createSmoothScroll, scrollFrame } from '~/composables/useSmoothScroll'
import { onFrame } from '~/composables/useFrameLoop'

/*
 * Scrolling is native again. The page used to be pinned with
 * `position: fixed; overflow: hidden` on html/body while a forked
 * smooth-scrollbar transformed a wrapper, which cost keyboard scrolling,
 * find-in-page, anchor links, scroll restoration and pinch zoom, and whose
 * integrator had no delta-time term. Lenis smooths the real scroll position
 * instead, so all of that works again for free.
 */
const scrollStateStore = useScrollStateStore()
const { scrollY, scrollYMax, scrollYVelocity } = storeToRefs(scrollStateStore)

let smoothScroll: ReturnType<typeof createSmoothScroll> | null = null
let stopPublish: (() => void) | null = null

onMounted(() => {
  smoothScroll = createSmoothScroll()

  // Mirror the frame state into the store once per frame for the reactive
  // consumers (ScrollTrack, BottomBar). The WebGL layer reads scrollFrame
  // directly and never goes through reactivity.
  stopPublish = onFrame('transform', () => {
    scrollY.value = scrollFrame.y
    scrollYVelocity.value = scrollFrame.velocity
    scrollYMax.value = scrollFrame.max
  })
})

onUnmounted(() => {
  stopPublish?.()
  smoothScroll?.destroy()
  smoothScroll = null
  scrollY.value = 0
  scrollYMax.value = 0
  scrollYVelocity.value = 0
})
</script>
