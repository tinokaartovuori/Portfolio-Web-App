<template>
  <Bar class="fixed bottom-8 sm:bottom-12 md:bottom-16">
    <ScrollToDiscover :showComponent="scrollToDiscoverVisible" />
  </Bar>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useScrollStateStore } from '~/store/scrollState'
const scrollStateStore = useScrollStateStore()
const { scrollY } = storeToRefs(scrollStateStore)

const scrollToDiscoverVisible = ref(true)
const { width, height } = useWindowSize()

watch(scrollY, () => {
  if (scrollY.value > height.value / 3) {
    scrollToDiscoverVisible.value = false
  } else {
    scrollToDiscoverVisible.value = true
  }
})
</script>
