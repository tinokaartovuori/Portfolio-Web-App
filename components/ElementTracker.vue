<template>
  <div ref="reader">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAppStateStore } from '~/store/appState'
const appStateStore = useAppStateStore()
const { domElementTracker } = storeToRefs(appStateStore) // Pinia store value for scrollY

const props = defineProps({
  threeReference: {
    type: String,
    required: true,
  },
})

const reader = ref<HTMLElement | null>(null)

onMounted(() => {
  if (!props.threeReference) return
  if (!reader.value) return
  // get the slot children
  const slotChildren = reader.value.children
  const firstChild = slotChildren[0] as HTMLElement
  if (!firstChild) return

  // Add the element to the domElementTracker store
  domElementTracker.value[props.threeReference] = firstChild
})
</script>

<style scoped></style>
