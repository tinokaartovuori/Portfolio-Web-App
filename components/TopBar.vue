<template>
  <Bar class="fixed top-8 sm:top-12 md:top-16">
    <div
      class="flex h-full justify-center align-middle xs:mr-2 sm:mr-4 md:mr-6"
    >
      <NuxtLink to="/" class="flex items-center justify-center">
        <WaveText
          text="Tino Kaartovuori"
          class="text-sm font-light text-onyx dark:text-platinum xs:text-base sm:text-xl md:text-2xl"
          onHover
        />
      </NuxtLink>
    </div>
    <div class="flex w-full justify-end">
      <div class="flex xs:mr-2 sm:mr-4 md:mr-6">
        <NuxtLink to="/about" class="flex items-center justify-center">
          <WaveText
            text="About"
            class="text-sm font-light text-onyx dark:text-platinum xs:text-base sm:text-xl md:text-2xl"
            onHover
          />
        </NuxtLink>
      </div>
      <div
        class="-mr-4 scale-[0.5] xs:scale-[0.6] sm:mr-0 sm:scale-[0.7] md:scale-[0.8] lg:scale-100"
      >
        <ThemeSwitch />
      </div>
    </div>
  </Bar>
</template>

<script setup lang="ts"></script>
