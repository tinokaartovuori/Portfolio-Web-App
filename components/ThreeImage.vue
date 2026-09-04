<template>
  <img
    ref="threeImg"
    :src="imageUrl"
    :alt="alt"
    class="block h-auto w-full opacity-0"
    crossorigin="anonymous"
    decoding="async"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useThreeObjectStateStore } from '~/store/threeObjectState'
const threeObjectStateStore = useThreeObjectStateStore()

const props = defineProps({
  imageUrl: {
    type: String,
    required: true,
  },
  threeReference: {
    type: String,
    required: true,
  },
  alt: {
    type: String,
    default: '',
  },
})

const threeImg = ref<HTMLImageElement | null>(null)
// The node we registered, so unmount can only ever drop our own entry
let registered: HTMLImageElement | null = null

onMounted(() => {
  if (!props.threeReference) return
  if (!props.imageUrl) return
  if (!threeImg.value) return

  // Add the element to the domElementTracker store
  threeObjectStateStore.addThreeImage(props.threeReference, threeImg.value)
  registered = threeImg.value
})

onUnmounted(() => {
  // The registry is global, so a detached image has to drop out of it again
  if (!registered) return
  threeObjectStateStore.remove(props.threeReference, registered)
  registered = null
})
</script>

<style scoped></style>
