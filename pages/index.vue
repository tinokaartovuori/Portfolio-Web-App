<template>
  <ScrollContainer>
    <ElementTracker threeReference="homeIntro">
      <div class="home-intro mb-32 h-screen w-full">
        <div
          class="index-intro_wrapper flex h-screen w-full items-center justify-center"
        >
          <div class="-mt-[5vh]">
            <p
              class="xxs:text-xl text-onyx dark:text-platinum text-lg sm:text-2xl md:text-4xl lg:text-5xl"
            >
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Modi quis
              similique quas, autem possimus reprehenderit perspiciatis
              voluptatem pariatur placeat fugiat saepe illo nobis sapiente
              asperiores!
            </p>
            <WaveText
              text="Lorem ipsum dolor!"
              class="xxs:text-xl text-onyx dark:text-platinum text-lg sm:text-2xl md:text-3xl lg:text-4xl"
            /><br />
            <button class="mt-10 cursor-pointer">
              <!-- TODO: Make a nice custom animated link -->
              <span
                class="xxs:text-xl text-onyx dark:text-platinum text-lg sm:text-2xl md:text-3xl lg:text-4xl"
                >→
              </span>
              <span
                class="xxs:text-xl text-onyx dark:text-platinum text-lg sm:text-2xl md:text-3xl lg:text-4xl"
                >Lorem ipsum dolor</span
              >
            </button>
          </div>
        </div>
      </div>
    </ElementTracker>
    <div class="mb-32 flex h-full w-full flex-col px-[12%] md:flex-row">
      <a>
        <ThreeImage
          threeReference="testImage"
          imageUrl="//live.staticflickr.com/65535/51289089076_825c2258b3_h.jpg"
        />
      </a>
      <div class="flex h-auto w-full flex-col content-between justify-between">
        <span class="text-onyx dark:text-platinum text-2xl">Test Image</span>
        <span class="text-onyx dark:text-platinum text-xl">Such Wow</span>
      </div>
    </div>
    <div class="mb-32 flex h-full w-full flex-col px-[12%] md:flex-row">
      <div class="flex h-auto w-full flex-col content-between justify-between">
        <span class="text-onyx dark:text-platinum text-2xl">Test Image</span>
        <span class="text-onyx dark:text-platinum text-xl">Such Wow</span>
      </div>
      <a>
        <ThreeImage
          threeReference="testImage2"
          imageUrl="//live.staticflickr.com/65535/52073317079_1d607ae166_h.jpg"
        />
      </a>
    </div>
    <div class="grid h-[20vw] grid-cols-4">
      <div class="bg-green-400/20"></div>
      <div class="bg-blue-400/20"></div>
      <ElementTracker threeReference="testSection2">
        <div class="h-full w-full bg-purple-400/20"></div>
      </ElementTracker>
      <div class="bg-red-400/20"></div>
    </div>
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

<style scoped>
.index-intro_wrapper {
  position: absolute;
  left: calc(3.125px + 12.5%);
  right: calc(3.125px + 12.5%);
  width: calc(-6.25px + 75%);
}
</style>
