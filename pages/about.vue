<!-- TODO: About page -->
<template>
  <ScrollContainer>
    <TestSection class="bg-red-500/50" />
    <TestSection class="bg-green-500/50" />
    <TestSection class="bg-blue-500/50" />
    <TestSection class="bg-purple-500/50" />
    <TestSection class="bg-yellow-500/50" />
    <TestSection class="bg-red-500/50" />
    <TestSection class="bg-green-500/50" />
    <TestSection class="bg-blue-500/50" />
    <TestSection class="bg-purple-500/50" />
    <TestSection class="bg-yellow-500/50" />
  </ScrollContainer>
</template>

<script setup lang="ts">
import { useThreeObjectStateStore } from '@/store/threeObjectState'
const threeObjectStateStore = useThreeObjectStateStore()

// Make sure to reset the store
threeObjectStateStore.reset()
</script>
