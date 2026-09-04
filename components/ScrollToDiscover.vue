<template>
  <transition name="fade">
    <div v-show="showComponent" class="flex">
      <WaveText
        text="Scroll to discover"
        class="text-sm font-light text-onyx dark:text-platinum xs:text-base sm:text-xl md:text-2xl"
      />
      <div
        aria-hidden="true"
        class="up-and-down px-2 text-sm font-light text-onyx dark:text-platinum xs:text-base sm:text-xl md:text-2xl"
      >
        ↓
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    showComponent?: boolean
  }>(),
  {
    showComponent: false,
  },
)
</script>

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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}

.fade-enter-from /* .fade-enter in < 2.1.8 */ {
  opacity: 0;
}

.fade-leave-to /* .fade-leave-active in < 2.1.8 */ {
  opacity: 0;
}

/* The arrow bobs forever, so it is exactly what this preference is about. */
@media (prefers-reduced-motion: reduce) {
  .up-and-down {
    animation: none;
  }

  .fade-enter-active,
  .fade-leave-active {
    transition-duration: 1ms;
  }
}
</style>
