<template>
  <div
    ref="scrollElement"
    class="h-full w-full overflow-hidden outline-none"
    tabindex="-1"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'

import { useAppStateStore } from '~/store/appState'
import Scrollbar from 'smooth-scrollbar'
import OverscrollPlugin from 'smooth-scrollbar/plugins/overscroll'
import type { Data2d } from 'smooth-scrollbar/interfaces'

const appStateStore = useAppStateStore()
const scrollElement = ref<HTMLElement | null>(null)
const scrollBar = ref<Scrollbar | null>(null)

// Scroll position related stuff
const { scrollY } = storeToRefs(appStateStore) // Pinia store value for scrollY
const scrollYWithoutOverscroll = ref<number>(0)

onMounted(() => {
  /* Initializing the scrollbar */
  Scrollbar.use(OverscrollPlugin)
  if (!scrollElement.value) return
  scrollBar.value = Scrollbar.init(scrollElement.value, {
    continuousScrolling: false,
    damping: 0.1,
    renderByPixels: true,
    alwaysShowTracks: true,
    delegateTo: document, // this is to make sure that the scroll event is not captured by the child elements
    plugins: {
      overscroll: {
        onScroll(overscroll: Data2d) {
          scrollY.value = overscroll.y + scrollYWithoutOverscroll.value
        },
        effect: 'bounce',
        damping: 0.1,
        maxOverscroll: 600,
      },
    },
  })
  // Delete scroll tracks
  scrollBar.value.track.xAxis.element.remove()
  scrollBar.value.track.yAxis.element.remove()

  scrollBar.value.addListener(({ offset }) => {
    scrollYWithoutOverscroll.value = offset.y
    scrollY.value = offset.y
  })
})
</script>
