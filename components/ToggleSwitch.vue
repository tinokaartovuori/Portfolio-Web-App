<template>
  <!--
    A switch whose look is pure CSS from the `dark` class on <html>: the pill
    and thumb colours, the thumb's side and which icon shows all follow the
    theme, so the server HTML, the hydrating client and the settled page all
    render the same state and nothing snaps in or fades up on mount. Only the
    travel and the crossfade are transitions, in the scoped block below (a
    Tailwind `transition-*` utility would replace the global colour transition
    list instead of adding to it).
  -->
  <button
    type="button"
    role="switch"
    class="switch relative z-10 flex h-8 w-16 cursor-pointer appearance-none items-center rounded-full bg-onyx p-1 dark:bg-platinum"
    :aria-checked="checked"
    :aria-label="label"
    @click="toggle"
  >
    <div
      class="thumb absolute z-10 h-6 w-6 translate-x-8 rounded-full bg-platinum dark:translate-x-0 dark:bg-onyx"
    ></div>
    <div class="thumb absolute h-6 w-6 translate-x-0 dark:translate-x-8">
      <div
        v-if="onIcon"
        class="icon absolute fill-platinum opacity-100 dark:opacity-0"
      >
        <component :is="onIcon" aria-hidden="true" />
      </div>
      <div
        v-if="offIcon"
        class="icon absolute fill-onyx opacity-0 dark:opacity-100"
      >
        <component :is="offIcon" aria-hidden="true" />
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
const props = defineProps({
  /** The parent owns the truth; this only reports it and asks to flip it. */
  checked: {
    type: Boolean,
    required: false,
    default: false,
  },
  /** Shown when checked: the light theme's sun. */
  onIcon: {
    type: Object,
    required: false,
  },
  /** Shown when not: the dark theme's moon. */
  offIcon: {
    type: Object,
    required: false,
  },
  label: {
    // Accessible name for the switch, since it only renders icons
    type: String,
    required: false,
    default: 'Toggle',
  },
})

const emits = defineEmits(['update:checked'])

function toggle() {
  emits('update:checked', !props.checked)
}
</script>

<style scoped>
.switch {
  transition:
    background-color 600ms cubic-bezier(0.4, 0, 0.2, 1),
    color 600ms cubic-bezier(0.4, 0, 0.2, 1);
}
/* Tailwind 4's translate-x-* utilities set the `translate` property, not a
   transform, so that is what has to be transitioned or the thumb jumps */
.thumb {
  transition:
    translate 500ms cubic-bezier(0.4, 0, 0.2, 1),
    transform 500ms cubic-bezier(0.4, 0, 0.2, 1),
    background-color 600ms cubic-bezier(0.4, 0, 0.2, 1);
}
.icon {
  transition:
    opacity 250ms cubic-bezier(0.4, 0, 0.2, 1),
    fill 600ms cubic-bezier(0.4, 0, 0.2, 1);
}
@media (prefers-reduced-motion: reduce) {
  .switch,
  .thumb,
  .icon {
    transition-duration: 1ms;
  }
}
</style>
