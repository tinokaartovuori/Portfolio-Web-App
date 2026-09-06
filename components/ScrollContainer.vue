<template>
  <!--
    overflow-clip: anything reaching past the right edge is clipped here
    rather than widening a phone's layout viewport (see the architecture
    notes, "nothing may widen the page"), and anything reaching past the
    bottom — the WebGL canvas host, translated over the viewport with a
    margin below it — is clipped rather than lengthening the document,
    which let a phone scroll past the end of the page. clip, not hidden: it
    makes no scroll container, so the document scrolls as before.
  -->
  <div ref="content" class="relative z-10 w-full overflow-clip">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'

import { useScrollStateStore } from '~/store/scrollState'
import { createSmoothScroll, scrollFrame } from '~/composables/useSmoothScroll'
import { onFrame } from '~/composables/useFrameLoop'

/*
 * Scrolling is native. The page used to be pinned with
 * `position: fixed; overflow: hidden` on html/body while a forked
 * smooth-scrollbar transformed a wrapper, which cost keyboard scrolling,
 * find-in-page, anchor links, scroll restoration and pinch zoom, and whose
 * integrator had no delta-time term. Lenis smooths the real scroll position
 * instead, so all of that works again for free.
 *
 * The one thing native scrolling cannot do is go past its own edges, so the
 * rubber band translates this wrapper instead. Everything that scrolls has to
 * live inside it, and nothing fixed may — a transformed ancestor becomes the
 * containing block of fixed descendants.
 */
const scrollStateStore = useScrollStateStore()
const { scrollY, scrollYMax, scrollYVelocity } = storeToRefs(scrollStateStore)

const content = ref<HTMLElement | null>(null)

let smoothScroll: ReturnType<typeof createSmoothScroll> | null = null
let stopPublish: (() => void) | null = null

onMounted(() => {
  if (!content.value) return
  smoothScroll = createSmoothScroll(content.value)

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
