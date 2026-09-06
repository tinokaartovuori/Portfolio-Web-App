<template>
  <transition name="fade">
    <div v-show="showComponent" class="flex items-baseline">
      <WaveText
        text="Scroll to discover"
        class="text-lg font-light text-onyx sm:text-xl md:text-2xl dark:text-platinum"
      />
      <BobbingArrow
        class="px-2 text-lg font-light text-onyx sm:text-xl md:text-2xl dark:text-platinum"
      />
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
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.35s;
}

.fade-enter-from /* .fade-enter in < 2.1.8 */ {
  opacity: 0;
}

.fade-leave-to /* .fade-leave-active in < 2.1.8 */ {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .fade-enter-active,
  .fade-leave-active {
    transition-duration: 1ms;
  }
}
</style>
