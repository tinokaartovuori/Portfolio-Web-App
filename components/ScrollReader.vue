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
import { useAppStateStore } from '~/store/appState'
import { storeToRefs } from 'pinia'
import Scrollbar from 'smooth-scrollbar'

const appStateStore = useAppStateStore()
const { scrollY } = storeToRefs(appStateStore) // Pinia store value for scrollY
const scrollElement = ref<HTMLElement | null>(null)
const scrollbar = ref<Scrollbar | null>(null)

onMounted(() => {
  if (!scrollElement.value) return
  scrollbar.value = Scrollbar.init(scrollElement.value, {
    continuousScrolling: false,
    damping: 0.1,
    renderByPixels: true,
    alwaysShowTracks: true,
    // speed: 0.8,
    // syncCallbacks: true,
  })

  scrollbar.value.addListener(({ offset }) => {
    // Here we can listen the scroll event
  })
})
</script>

<style scoped></style>
