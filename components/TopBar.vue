<template>
  <Bar class="fixed top-8 sm:top-12 md:top-16">
    <h1 class="xs:mr-2 flex h-full justify-center align-middle sm:mr-4 md:mr-6">
      <NuxtLink to="/" class="flex items-center justify-center">
        <WaveText
          text="Tino Kaartovuori"
          class="xs:text-base text-onyx dark:text-platinum text-sm font-light sm:text-xl md:text-2xl"
          onHover
        />
      </NuxtLink>
    </h1>
    <div class="flex w-full justify-end">
      <div class="xs:mr-2 flex sm:mr-4 md:mr-6">
        <NuxtLink to="/about" class="flex items-center justify-center">
          <WaveText
            text="About"
            class="xs:text-base text-onyx dark:text-platinum text-sm font-light sm:text-xl md:text-2xl"
            onHover
          />
        </NuxtLink>
      </div>
      <div
        class="xs:scale-[0.6] -mr-4 scale-[0.5] sm:mr-0 sm:scale-[0.7] md:scale-[0.8] lg:scale-100"
      >
        <ThemeSwitch />
      </div>
    </div>
  </Bar>
</template>

<script setup lang="ts"></script>
