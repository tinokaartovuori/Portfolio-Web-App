<!--
  The one arrow on the site, bobbing slowly along the way it points: the
  scroll prompt, the hero's "See the work", every "Read more", the project
  page's links and "All work", the footer's email and "Back to top" all share
  it, so every invitation reads as the same gesture. Decorative; the text
  beside it carries the meaning.

  Drawn, not typed: the font's arrow glyphs were thin and sharp against the
  rounded type, so this is a stroke with round caps and joins, sized and
  coloured by the text it sits in (1em, currentColor), turned for the
  direction. The stroke is a little heavier than the type's hairline so the
  head reads as a soft chevron rather than a pin.
-->
<template>
  <span
    aria-hidden="true"
    class="bob inline-block"
    :style="{ '--dx': `${axis.x}px`, '--dy': `${axis.y}px` }"
  >
    <svg
      viewBox="0 0 24 24"
      class="relative top-[0.2em] block size-[1em]"
      :style="{ transform: `rotate(${angle}deg)` }"
      fill="none"
      stroke="currentColor"
      stroke-width="2.25"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M4.5 12h15" />
      <path d="M13 5.5l6.5 6.5-6.5 6.5" />
    </svg>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Direction = 'down' | 'up' | 'right' | 'left' | 'up-right'

const props = withDefaults(defineProps<{ direction?: Direction }>(), {
  direction: 'down',
})

/** The arrow is drawn pointing right; the rest are turns of it. */
const angles: Record<Direction, number> = {
  right: 0,
  down: 90,
  left: 180,
  up: -90,
  'up-right': -45,
}

/** Half the bob's travel, px, along the arrow's own axis. */
const axes: Record<Direction, { x: number; y: number }> = {
  down: { x: 0, y: 3 },
  up: { x: 0, y: -3 },
  right: { x: 3, y: 0 },
  left: { x: -3, y: 0 },
  'up-right': { x: 2, y: -2 },
}

const angle = computed(() => angles[props.direction])
const axis = computed(() => axes[props.direction])
</script>

<style scoped>
/*
 * Every arrow sits in an `items-baseline` flex row, where a box with no text
 * of its own is aligned by its bottom edge: the whole arrow would stand on
 * the baseline and ride high. The svg is shifted down (relative, so the
 * bob's transform and the turn are untouched) until its centre sits on the
 * middle of the x-height, where the old glyph's did.
 */
.bob {
  animation: bob 2s ease-out infinite;
}

/* From a little behind to a little ahead, along the direction it points */
@keyframes bob {
  0%,
  100% {
    transform: translate(calc(var(--dx) * -1), calc(var(--dy) * -1));
  }
  50% {
    transform: translate(var(--dx), var(--dy));
  }
}

/* The arrow bobs forever, so it is exactly what this preference is about. */
@media (prefers-reduced-motion: reduce) {
  .bob {
    animation: none;
  }
}
</style>
