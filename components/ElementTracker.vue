<template>
  <div ref="reader">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { useThreeObjectStateStore } from '~/store/threeObjectState'
const threeObjectStateStore = useThreeObjectStateStore()

const props = defineProps({
  threeReference: {
    type: String,
    required: true,
  },
  object: {
    type: String,
    required: true,
  },
})

const reader = ref<HTMLElement | null>(null)
// The node we registered, so unmount can only ever drop our own entry
let registered: HTMLElement | null = null

onMounted(() => {
  if (!props.threeReference) return
  if (!reader.value) return
  // get the slot children
  const slotChildren = reader.value.children
  const firstChild = slotChildren[0] as HTMLElement
  if (!firstChild) return

  // Add the element to the store
  threeObjectStateStore.addThreeElement(
    props.threeReference,
    firstChild,
    props.object,
  )
  registered = firstChild
})

onUnmounted(() => {
  // The registry is global, so a detached element has to drop out of it again
  if (!registered) return
  threeObjectStateStore.remove(props.threeReference, registered)
  registered = null
})
</script>

<style scoped></style>
