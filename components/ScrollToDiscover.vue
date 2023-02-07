<template>
  <!-- TODO: Here we need to add the press event that starts scrolling the page -->
  <div class="flex">
    <WaveText
      text="Scroll to discover"
      class="xs:text-base text-onyx dark:text-platinum text-sm font-light sm:text-xl md:text-2xl"
    />
    <div
      class="up-and-down xs:text-base text-onyx dark:text-platinum px-2 text-sm font-light sm:text-xl md:text-2xl"
    >
      ↓
    </div>
  </div>
</template>

<style scoped>
.up-and-down {
  animation: MoveUpDown 2s ease-out infinite;
  position: relative;
  left: 0;
  bottom: 0;
}

@keyframes MoveUpDown {
  0%,
  100% {
    transform: translateY(-3px);
  }
  50% {
    transform: translateY(3px);
  }
}
</style>
