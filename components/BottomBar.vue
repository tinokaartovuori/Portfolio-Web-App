<template>
  <!-- No veil here: the prompt is gone by the time content reaches it -->
  <Bar edge="bottom" :veil="false">
    <ScrollToDiscover :showComponent="scrollToDiscoverVisible" />
  </Bar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useScrollStateStore } from '~/store/scrollState'
import { motion } from '~/motion.config'
const scrollStateStore = useScrollStateStore()
const { scrollY, scrollYMax, scrollPromptSuppressed } =
  storeToRefs(scrollStateStore)

const { height } = useWindowSize()

/*
 * Derived rather than watched: a watcher only fires on a *change* in scrollY,
 * so a restored scroll position or a page that never scrolls left the prompt
 * showing. scrollYMax is 0 both before the first frame publishes and on a page
 * shorter than the viewport, and there is nothing to discover in either case.
 *
 * The bottom check matters on a page only slightly taller than the viewport:
 * there the whole scrollable range can sit inside the threshold, so without it
 * the prompt would keep inviting a scroll that has already run out.
 *
 * A page can also suppress it outright: the home page does when its hero does
 * not fit the viewport, because the prompt would then sit on the hero's text.
 *
 * It goes the moment scrolling starts (motion.scrollPrompt.hideAfter): it is
 * an invitation, and one already taken up has nothing left to say.
 */
const route = useRoute()
const scrollToDiscoverVisible = computed(() => {
  if (scrollPromptSuppressed.value) return false
  // Before the first frame has published the page's length, the server and
  // the hydrating client agree on showing it on the home page, which has a
  // hero and always scrolls: the prompt is part of the first paint rather
  // than something that fades in after it
  if (scrollYMax.value <= 0) return route.path === '/'
  return (
    scrollY.value < scrollYMax.value &&
    scrollY.value <= Math.min(motion.scrollPrompt.hideAfter, height.value / 3)
  )
})
</script>
