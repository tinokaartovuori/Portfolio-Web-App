<template>
  <ScrollReader>
    <div class="home-intro">
      <div
        class="index-intro_wrapper flex h-screen w-full items-center justify-center"
      >
        <div>
          <p class="text-3xl text-white md:text-4xl lg:text-5xl">
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Modi quis
            similique quas, autem possimus reprehenderit perspiciatis voluptatem
            pariatur placeat fugiat saepe illo nobis sapiente asperiores, totam
            dolore eos vel obcaecati!
          </p>
          <button class="mt-10 cursor-pointer">
            <!-- TODO: Make a nice custom animated link -->
            <span class="text-3xl text-white md:text-4xl lg:text-5xl">→ </span>
            <span class="text-3xl text-white md:text-4xl lg:text-5xl"
              >Test Button</span
            >
          </button>
        </div>
      </div>
      <!-- For scroll testing -->
      <div style="height: 3000px"></div>
    </div>
  </ScrollReader>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAppStateStore } from '~/store/appState'
const appStateStore = useAppStateStore()
const { scrollY } = storeToRefs(appStateStore)
</script>

<style scoped>
.index-intro_wrapper {
  position: absolute;
  left: calc(3.125px + 12.5%);
  right: calc(3.125px + 12.5%);
  width: calc(-6.25px + 75%);
}
</style>
