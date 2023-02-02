<template>
  <ScrollContainer>
    <div class="home-intro h-screen w-full">
      <div
        class="index-intro_wrapper flex h-screen w-full items-center justify-center"
      >
        <div>
          <p
            class="bg-slate-400/50 text-3xl text-black dark:bg-black/50 dark:text-white md:text-4xl lg:text-5xl"
          >
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Modi quis
            similique quas, autem possimus reprehenderit perspiciatis voluptatem
            pariatur placeat fugiat saepe illo nobis sapiente asperiores, totam
            dolore eos vel obcaecati!
          </p>
          <WaveText
            text="Lorem ipsum dolor!"
            class="text-3xl text-black dark:text-white md:text-4xl lg:text-5xl"
          /><br />
          <button class="mt-10 cursor-pointer">
            <!-- TODO: Make a nice custom animated link -->
            <span
              class="text-3xl text-black dark:text-white md:text-4xl lg:text-5xl"
              >→
            </span>
            <span
              class="text-3xl text-black dark:text-white md:text-4xl lg:text-5xl"
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
