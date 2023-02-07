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
import gsap from 'gsap'

import { useAppStateStore } from '~/store/appState'
import Scrollbar from 'smooth-scrollbar'
import OverscrollPlugin from 'smooth-scrollbar/plugins/overscroll'
import SpeedControlPlugin from '../smooth-scrollbar-plugins/speedControl'
import type { Data2d } from 'smooth-scrollbar/interfaces'

const appStateStore = useAppStateStore()
const scrollElement = ref<HTMLElement | null>(null)
const scrollBar = ref<Scrollbar | null>(null)

// Scroll position related stuff
const { scrollY, scrollYMax, scrollYSpeed } = storeToRefs(appStateStore) // Pinia store
const scrollYWithoutOverscroll = ref<number>(0)

onMounted(() => {
  /* Initializing the scrollbar */
  Scrollbar.use(OverscrollPlugin)
  Scrollbar.use(SpeedControlPlugin)

  if (!scrollElement.value) return
  scrollBar.value = Scrollbar.init(scrollElement.value, {
    continuousScrolling: false,
    damping: 0.1,
    renderByPixels: false,
    alwaysShowTracks: true,
    delegateTo: document, // this is to make sure that the scroll event is not captured by the child elements
    plugins: {
      overscroll: {
        onScroll(overscroll: Data2d) {
          const prevousScrollY = scrollY.value
          scrollY.value = overscroll.y + scrollYWithoutOverscroll.value
          if (Math.abs(scrollY.value - prevousScrollY) < 0.1) {
            scrollYSpeed.value = 0
          } else {
            scrollYSpeed.value = scrollY.value - prevousScrollY
          }
        },
        effect: 'bounce',
        damping: 0.05,
        maxOverscroll: 1200,
      },
      speedControl: {
        speed: 1,
        maxSpeed: 1200,
      },
    },
  })

  // Delete scroll tracks
  scrollBar.value.track.xAxis.element.remove()
  scrollBar.value.track.yAxis.element.remove()

  scrollBar.value.addListener(({ offset, limit }) => {
    const prevousScrollY = scrollY.value
    scrollYWithoutOverscroll.value = offset.y
    scrollY.value = offset.y
    scrollYMax.value = limit.y
    // If scroll delta abs is smaller than 0.1, then set scrollYSpeed to 0
    if (Math.abs(scrollY.value - prevousScrollY) < 0.1) {
      scrollYSpeed.value = 0
    } else {
      scrollYSpeed.value = scrollY.value - prevousScrollY
    }
  })

  // Update scrollYMax when child content height changes
  const scrollContent = scrollElement.value.children[0] as HTMLElement
  const resizeObserver = new ResizeObserver(() => {
    if (!scrollElement.value) return
    scrollYMax.value =
      scrollContent.clientHeight - scrollElement.value.clientHeight
  })
  resizeObserver.observe(scrollContent)
})
</script>
