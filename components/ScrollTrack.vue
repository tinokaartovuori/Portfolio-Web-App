<template>
  <div
    ref="track"
    class="bg-onyx xs:w-1 absolute right-0 top-0 bottom-0 w-0.5 dark:bg-neutral-400 sm:w-1.5"
  >
    <div
      ref="indicator"
      class="xs:w-1 absolute right-0 top-0 w-0.5 rounded-full bg-pink-500 sm:w-1.5"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import gsap from 'gsap'
import { storeToRefs } from 'pinia'
import { useAppStateStore } from '~/store/appState'
const appStateStore = useAppStateStore()
const { scrollY, scrollYMax } = storeToRefs(appStateStore) //

const track = ref<HTMLElement | null>(null)
const indicator = ref<HTMLElement | null>(null)

gsap.ticker.add(() => {
  if (!track.value || !indicator.value) return
  const trackHeight = track.value.clientHeight
  // Indicator height is ratio of track height to scrollYMax
  const indicatorHeight = ((trackHeight / scrollYMax.value) * trackHeight) / 2
  const scrollYPercentage = scrollY.value / scrollYMax.value
  const indicatorY = scrollYPercentage * (trackHeight - indicatorHeight)
  gsap.set(indicator.value, { y: indicatorY })
  // Update indicator height
  gsap.set(indicator.value, { height: indicatorHeight })
})
</script>

<style scoped></style>
