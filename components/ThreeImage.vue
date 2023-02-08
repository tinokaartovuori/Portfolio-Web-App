<template>
  <img ref="threeImg" :src="imageUrl" class="invisible" />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useThreeObjectStateStore } from '~/store/threeObjectState'
const threeObjectStateStore = useThreeObjectStateStore()
const threeObjectState = storeToRefs(threeObjectStateStore)

const props = defineProps({
  imageUrl: {
    type: String,
    required: true,
  },
  threeReference: {
    type: String,
    required: true,
  },
})

const threeImg = ref<HTMLImageElement | null>(null)

onMounted(() => {
  if (!props.threeReference) return
  if (!props.imageUrl) return
  if (!threeImg.value) return

  // Add the element to the domElementTracker store
  threeObjectStateStore.addThreeImage(props.threeReference, threeImg.value)
})
</script>

<style scoped></style>
