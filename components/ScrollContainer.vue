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
import { ref, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { gsap } from 'gsap'

import { useScrollStateStore } from '~/store/scrollState'
import Scrollbar from '@tinokaartovuori/smooth-scrollbar'
import OverscrollPlugin from 'smooth-scrollbar/plugins/overscroll'
import SpeedControlPlugin from '../smooth-scrollbar-plugins/speedControl'
import type { Data2d } from 'smooth-scrollbar/interfaces'

const scrollStateStore = useScrollStateStore()
const scrollElement = ref<HTMLElement | null>(null)
const scrollBar = ref<Scrollbar | null>(null)

// Scroll position related stuff
const { scrollY, scrollYMax, scrollYSpeed } = storeToRefs(scrollStateStore) // Pinia store
const scrollYWithoutOverscroll = ref<number>(0)

const resizeObserver = ref<ResizeObserver | null>(null)

let previousScrollY = 0

/*
 * NOTE: We are rendering the scrollbar manually to make sure that the syncronization
 * between the scrollbar and Three.js is working properly.
 * This can be moved to a separate component along with the three.js loop to make a combined
 * render loop if needed.
 */
const renderScrollBar = () => {
  scrollBar.value?.render()
  /* The only place where scrollYSpeed is written: the distance travelled during
   * this frame, no matter which of the scrollbar callbacks moved scrollY. */
  const delta = scrollY.value - previousScrollY
  previousScrollY = scrollY.value
  // If scroll delta abs is smaller than 0.1, then set scrollYSpeed to 0
  scrollYSpeed.value = Math.abs(delta) < 0.1 ? 0 : delta
}

onMounted(() => {
  /* Initializing the scrollbar */
  Scrollbar.use(OverscrollPlugin as any)
  Scrollbar.use(SpeedControlPlugin)

  if (!scrollElement.value) return
  scrollBar.value = Scrollbar.init(scrollElement.value, {
    continuousScrolling: false,
    damping: 0.1,
    renderByPixels: false,
    alwaysShowTracks: true,
    externalRAF: true,
    plugins: {
      overscroll: {
        onScroll(overscroll: Data2d) {
          scrollY.value = overscroll.y + scrollYWithoutOverscroll.value
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
    scrollYWithoutOverscroll.value = offset.y
    scrollY.value = offset.y
    scrollYMax.value = limit.y
  })

  // Update scrollYMax when child content height changes
  const scrollContent = scrollElement.value.firstElementChild
  if (scrollContent) {
    resizeObserver.value = new ResizeObserver(() => {
      if (!scrollBar.value) return
      /* Recalculating the geometry keeps limit.y - the scrollbar's own idea of
       * the maximum scroll position - the single source of truth. */
      scrollBar.value.update()
      scrollYMax.value = scrollBar.value.limit.y
    })
    resizeObserver.value.observe(scrollContent)
  }

  gsap.ticker.add(renderScrollBar)
})

onUnmounted(() => {
  // Stop rendering the scrollbar
  gsap.ticker.remove(renderScrollBar)

  // Reset scroll position
  scrollY.value = 0
  scrollYMax.value = 0
  scrollYSpeed.value = 0

  // Remove delegateTo document
  scrollBar.value?.destroy()

  // Remove resize observer
  if (resizeObserver.value) {
    resizeObserver.value.disconnect()
  }
})
</script>
