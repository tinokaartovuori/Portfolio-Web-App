<!-- TODO: About page -->
<template>
  <ScrollContainer>
    <TestSection class="bg-red-500/50" />
    <div class="mb-32 flex h-full w-full flex-col px-[12%] md:flex-row">
      <a>
        <ElementTracker threeReference="testSection2" object="CrazyPlane">
          <div class="mx-3 h-2 w-[50vw]"></div>
        </ElementTracker>
      </a>
      <div class="flex h-auto w-full flex-col content-between justify-between">
        <span class="text-onyx dark:text-platinum text-2xl">Test Crazy</span>
        <span class="text-onyx dark:text-platinum text-xl">Such Wow</span>
      </div>
    </div>
    <div class="h-full w-full bg-purple-400/20"></div>
    <TestSection class="bg-green-500/50" />
    <div class="mb-32 flex h-full w-full flex-col px-[12%] md:flex-row">
      <a>
        <ElementTracker threeReference="testSection3" object="CrazyPlane">
          <div class="mx-3 h-2 w-[50vw]"></div>
        </ElementTracker>
      </a>
      <div class="flex h-auto w-full flex-col content-between justify-between">
        <span class="text-onyx dark:text-platinum text-2xl">Test Crazy</span>
        <span class="text-onyx dark:text-platinum text-xl">Such Wow</span>
      </div>
    </div>
    <TestSection class="bg-blue-500/50" />
    <TestSection class="bg-purple-500/50" />
    <TestSection class="bg-yellow-500/50" />
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
