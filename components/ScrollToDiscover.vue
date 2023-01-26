<template>
  <!-- TODO: Here we need to add the press event that starts scrolling the page -->
  <div class="flex">
    <WaveText repeat text="Scroll to discover" />
    <div class="up-and-down px-2 text-2xl text-white">↓</div>
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
