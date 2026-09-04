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
 */
const scrollToDiscoverVisible = computed(
  () =>
    !scrollPromptSuppressed.value &&
    scrollYMax.value > 0 &&
    scrollY.value < scrollYMax.value &&
    scrollY.value <= height.value / 3,
)
</script>
