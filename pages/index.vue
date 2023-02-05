<template>
  <ScrollContainer>
    <div class="home-intro h-screen w-full">
      <div
        class="index-intro_wrapper flex h-screen w-full items-center justify-center"
      >
        <div class="-mt-[5vh]">
          <p
            class="xxs:text-xl text-onyx text-lg dark:text-white sm:text-2xl md:text-4xl lg:text-5xl"
          >
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Modi quis
            similique quas, autem possimus reprehenderit perspiciatis voluptatem
            pariatur placeat fugiat saepe illo nobis sapiente asperiores!
          </p>
          <WaveText
            text="Lorem ipsum dolor!"
            class="xxs:text-xl text-onyx text-lg dark:text-white sm:text-2xl md:text-3xl lg:text-4xl"
          /><br />
          <button class="mt-10 cursor-pointer">
            <!-- TODO: Make a nice custom animated link -->
            <span
              class="xxs:text-xl text-onyx text-lg dark:text-white sm:text-2xl md:text-3xl lg:text-4xl"
              >→
            </span>
            <span
              class="xxs:text-xl text-onyx text-lg dark:text-white sm:text-2xl md:text-3xl lg:text-4xl"
              >Lorem ipsum dolor</span
            >
          </button>
        </div>
      </div>
    </div>
    <TestSection class="bg-white/50" />
    <TestSection class="bg-red-500/50" />
    <TestSection class="bg-green-500/50" />
    <TestSection class="bg-blue-500/50" />
    <TestSection class="bg-purple-500/50" />
    <TestSection class="bg-yellow-500/50" />
  </ScrollContainer>
</template>

<script setup lang="ts"></script>

<style scoped>
.index-intro_wrapper {
  position: absolute;
  left: calc(3.125px + 12.5%);
  right: calc(3.125px + 12.5%);
  width: calc(-6.25px + 75%);
}
</style>
