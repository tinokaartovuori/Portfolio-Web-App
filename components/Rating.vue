<!--
  A store rating, set in the same mono as the project meta: five stars in
  the accent filled to the score, the score over five, and where it comes
  from. Real text, so a screen reader gets "4.9 out of 5 on Google Play"
  rather than a row of glyphs. The score and the source are each kept on one
  line, so on a phone the row breaks between them, never inside "4.9 / 5".
-->
<template>
  <span
    class="inline-flex flex-wrap items-baseline gap-2 font-mono text-sm tracking-[0.1em] text-onyx/70 dark:text-platinum/70"
  >
    <!--
      Five drawn stars rather than the font's, with round joins so the points
      are softened rather than needle-sharp. Each is the outline, and over it
      the filled star clipped to the star's share of the score by a box of
      that width — so 4.9 shows four full stars and one nine-tenths full,
      and no ids reach the page.
    -->
    <span aria-hidden="true" class="inline-flex gap-0.5 self-center">
      <span
        v-for="(fill, i) in fills"
        :key="i"
        class="relative block size-[1.1em] text-accent"
      >
        <svg
          viewBox="0 0 24 24"
          class="absolute inset-0 size-full"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-opacity="0.55"
        >
          <path :d="star" />
        </svg>
        <span
          class="absolute inset-y-0 left-0 block overflow-hidden"
          :style="{ width: `${fill * 100}%` }"
        >
          <svg
            viewBox="0 0 24 24"
            class="size-[1.1em]"
            fill="currentColor"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
          >
            <path :d="star" />
          </svg>
        </span>
      </span>
    </span>
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

const star =
  'M12 3.5 14.47 8.6 20.56 9.22 15.99 13.3 17.29 19.28 12 16.2 6.71 19.28 8.01 13.3 3.44 9.22 9.53 8.6Z'

/** Each star's share of the score, 0–1: full up to the whole number, the
 * fraction on the next, empty after. */
const fills = computed(() => {
  const score = Math.min(5, Math.max(0, Number(props.value) || 0))
  return Array.from({ length: 5 }, (_, i) =>
    Math.min(1, Math.max(0, score - i)),
  )
})

const sources = computed(() =>
  Array.isArray(props.source)
    ? props.source
    : props.source
      ? [props.source]
      : [],
)
</script>
