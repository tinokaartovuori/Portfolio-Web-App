<!--
  A project's outward link: a store page, a repository, a film. Set like every
  other link on the site (the label on a hairline, the shared arrow after it)
  with two optional marks: an icon before the label for where it goes, and a
  flag after it for the language of what is there — a film narrated in
  Finnish says so before the click, and the anchor carries `hreflang` for the
  same reason.

  Both marks are drawn here rather than imported, like the rating's stars
  and the arrow, and at the same size in the accent, so they read as a
  pair: the YouTube mark is a rounded plate with the play triangle cut out
  of it, in the accent rather than the brand red; the game mark is a gamepad
  silhouette with the d-pad and two buttons cut out of it (a plate with the
  same cut-outs was tried first and did not read as a controller); the flag
  is the plate in the flag's own colours with the cross laid over it, and a
  hairline round it so the white still reads as a shape on the platinum
  page. Both are aria-hidden; the
  label and a visually hidden "in Finnish" carry the meaning. The link never
  wraps inside itself, and a `short` label stands in below `sm`, where the
  card's row has to hold it beside "Read more".
-->
<template>
  <a
    :href="to"
    target="_blank"
    rel="noopener"
    :hreflang="lang"
    class="group inline-flex items-baseline gap-2 whitespace-nowrap text-onyx dark:text-platinum"
  >
    <svg
      v-if="icon === 'youtube'"
      aria-hidden="true"
      viewBox="0 0 24 24"
      class="relative top-[0.16em] size-[1.05em] shrink-0 text-accent"
      fill="currentColor"
      fill-rule="evenodd"
    >
      <path
        d="M5 5.25h14A3.5 3.5 0 0 1 22.5 8.75v6.5a3.5 3.5 0 0 1-3.5 3.5H5a3.5 3.5 0 0 1-3.5-3.5v-6.5A3.5 3.5 0 0 1 5 5.25Zm5 3.6v6.3l5.4-3.15L10 8.85Z"
      />
    </svg>
    <svg
      v-else-if="icon === 'game'"
      aria-hidden="true"
      viewBox="0 0 24 24"
      class="relative top-[0.16em] size-[1.05em] shrink-0 text-accent"
      fill="currentColor"
    >
      <!--
        A gamepad silhouette: one outline — the top, a shoulder, a grip
        rounding under each corner and a notch between them — drawn
        clockwise, with a d-pad on the left and two buttons on the right
        drawn anticlockwise, so under the nonzero rule they are the only
        holes. One outline rather than a body plus two grip circles: where
        those overlapped the winding was two, and a cut-out there stayed
        solid.
      -->
      <path
        d="M7 5.5H17A4.5 4.5 0 0 1 21.5 10V14.5A4.2 4.2 0 0 1 13.1 14.5A1.1 1.1 0 0 0 10.9 14.5A4.2 4.2 0 0 1 2.5 14.5V10A4.5 4.5 0 0 1 7 5.5ZM6.9 8.5V9.9H5.5V11.1H6.9V12.5H8.1V11.1H9.5V9.9H8.1V8.5ZM15.8 10.55a1.05 1.05 0 0 0 0 2.1 1.05 1.05 0 0 0 0-2.1ZM18.6 8.15a1.05 1.05 0 0 0 0 2.1 1.05 1.05 0 0 0 0-2.1Z"
      />
    </svg>
    <span class="border-b border-current/30 pb-1">
      <template v-if="short">
        <span class="sm:hidden">{{ short }}</span>
        <span class="hidden sm:inline">{{ label }}</span>
      </template>
      <template v-else>{{ label }}</template>
    </span>
    <template v-if="lang === 'fi'">
      <span class="sr-only">, in Finnish</span>
      <!--
        The same plate as the YouTube mark (21×14, radius 3.5 in a 24 box)
        with the cross laid over it: the bars stay clear of the corner arcs,
        so nothing needs clipping and no ids reach the page.
      -->
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        class="relative top-[0.16em] size-[1.05em] shrink-0"
      >
        <rect x="1.5" y="5.25" width="21" height="14" rx="3.5" fill="#fff" />
        <rect x="7.33" y="5.25" width="3.5" height="14" fill="#002f6c" />
        <rect x="1.5" y="10.34" width="21" height="3.82" fill="#002f6c" />
        <rect
          x="1.5"
          y="5.25"
          width="21"
          height="14"
          rx="3.5"
          fill="none"
          stroke="currentColor"
          stroke-opacity="0.35"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    </template>
    <BobbingArrow direction="up-right" />
  </a>
</template>

<script setup lang="ts">
defineProps<{
  to: string
  label: string
  /** A shorter label for below `sm`, where the card's row is tight. */
  short?: string
  /** Where the link goes, for the mark before the label. */
  icon?: 'youtube' | 'game'
  /** The language of what is there, for the flag after the label. */
  lang?: 'fi'
}>()
</script>
