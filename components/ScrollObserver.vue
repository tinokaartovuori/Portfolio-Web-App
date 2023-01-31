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
import disableScroll from '../smooth-scrollbar-plugins/disableScroll'
import type { Data2d } from 'smooth-scrollbar/interfaces'

const appStateStore = useAppStateStore()
const { scrollY } = storeToRefs(appStateStore) // Pinia store value for scrollY
const scrollElement = ref<HTMLElement | null>(null)
const scrollBar = ref<Scrollbar | null>(null)

let scrollOffSet = ref<number>(0)

onMounted(() => {
  Scrollbar.use(disableScroll)
  if (!scrollElement.value) return
  scrollBar.value = Scrollbar.init(scrollElement.value, {
    continuousScrolling: false,
    damping: 0.4,
    renderByPixels: true,
    alwaysShowTracks: true,
    delegateTo: document, // this is to make sure that the scroll event is not captured by the child elements
    plugins: {
      // This disables the default scroll behaviour and
      // allows us to use our own scroll behaviour
      disableScroll: {
        lock: true,
        getDelta: onScrollDelta,
      },
    },
  })

  // Delete scroll tracks
  scrollBar.value.track.xAxis.element.remove()
  scrollBar.value.track.yAxis.element.remove()

  function onScrollDelta(delta: Data2d) {
    scrollOffSet.value -= delta.y
  }

  // TODO: Here we need to think how we want to "wrap around the scrollY value"

  // Use Gsap to "animate" scrollY
  gsap.ticker.add(function () {
    // Make the scrollY value follow the scrollOffSet value smoothly
    const delta = scrollY.value - scrollOffSet.value
    scrollY.value -= delta * 0.1
  })
})
</script>
