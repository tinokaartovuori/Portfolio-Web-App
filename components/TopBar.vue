<template>
  <Bar edge="top" compact>
    <div class="flex items-center justify-center xs:mr-2 sm:mr-4 md:mr-6">
      <NuxtLink
        to="/"
        class="pointer-events-auto flex items-center justify-center"
      >
        <WaveText
          text="Tino Kaartovuori"
          class="text-sm font-light text-onyx dark:text-platinum xs:text-base sm:text-xl md:text-2xl"
          onHover
        />
      </NuxtLink>
    </div>
    <div class="flex w-full justify-end">
      <nav aria-label="Main" class="flex xs:mr-2 sm:mr-4 md:mr-6">
        <NuxtLink
          to="/about"
          class="pointer-events-auto flex items-center justify-center"
        >
          <WaveText
            text="About"
            class="text-sm font-light text-onyx dark:text-platinum xs:text-base sm:text-xl md:text-2xl"
            onHover
          />
        </NuxtLink>
      </nav>
      <div
        class="pointer-events-auto -mr-4 scale-[0.5] xs:scale-[0.6] sm:mr-0 sm:scale-[0.7] md:scale-[0.8] lg:scale-100"
      >
        <ThemeSwitch />
      </div>
    </div>
  </Bar>
</template>

<script setup lang="ts"></script>
