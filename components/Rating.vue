<!--
  A store rating, set in the same mono as the project meta: a star in the
  accent, the score over five, and where it comes from. Real text, so a
  screen reader gets "4.9 out of 5 on Google Play" rather than a glyph. The
  score and the source are each kept on one line, so on a phone the row
  breaks between them, never inside "4.9 / 5".
-->
<template>
  <span
    class="inline-flex flex-wrap items-baseline gap-2 font-mono text-sm tracking-[0.1em] text-onyx/70 dark:text-platinum/70"
  >
    <!--
      A drawn star rather than the font's: filled in the accent and stroked
      in it too, with round joins, so the five points are softened rather
      than needle-sharp.
    -->
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      class="size-[1.1em] self-center text-accent"
      fill="currentColor"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linejoin="round"
    >
      <path
        d="M12 3.5 14.47 8.6 20.56 9.22 15.99 13.3 17.29 19.28 12 16.2 6.71 19.28 8.01 13.3 3.44 9.22 9.53 8.6Z"
      />
    </svg>
    <span class="whitespace-nowrap">
      <span class="text-onyx dark:text-platinum">{{ value }}</span>
      <span class="sr-only"> out of </span>
      <span aria-hidden="true"> / </span>
      <span>5</span>
    </span>
    <span
      v-if="sources.length"
      class="whitespace-nowrap text-onyx/45 dark:text-platinum/45"
    >
      <span aria-hidden="true">·</span>
      <span class="sr-only">on</span>
      {{ sources.join(' and ') }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** The score, as written ("4.9"). */
  value: string
  /** Where it comes from: one store, or the stores that agree on it. */
  source?: string | string[]
}>()

const sources = computed(() =>
  Array.isArray(props.source)
    ? props.source
    : props.source
      ? [props.source]
      : [],
)
</script>
