<template>
  <!--
    On every page, inside ScrollContainer: it contains nothing fixed, so it
    rides the rubber band like the rest of the document, and its light field
    follows because the mesh measures the translated box. It is also where
    the top bar's "Contact" lands: the anchor puts the panel's top edge at
    --bar-safe + 2rem (scroll-margin-top covers what the padding does not),
    so the padding is the gap to the section above and nothing else.
  -->
  <footer
    v-if="contact"
    id="contact"
    class="w-full scroll-mt-[calc(var(--bar-safe)_-_2rem)] px-(--page-gutter) pb-10 pt-16 text-onyx md:scroll-mt-[calc(var(--bar-safe)_-_4rem)] md:pb-14 md:pt-24"
  >
    <ElementTracker
      threeReference="footer-lights"
      object="LightField"
      variant="footer"
    >
      <div
        ref="panel"
        class="relative isolate flex flex-col items-start px-[6vw] py-20 will-change-transform sm:px-(--page-gutter) md:py-28"
      >
        <!-- The plate from the first frame; see the hero in pages/index.vue -->
        <div
          data-plate
          aria-hidden="true"
          class="plate pointer-events-none absolute -z-10"
          :style="plateStyle('footer')"
        />
        <p
          class="mb-6 text-sm uppercase tracking-[0.18em] text-onyx/50 dark:text-platinum/50 sm:text-base"
        >
          {{ contact.eyebrow }}
        </p>
        <h2
          class="max-w-[14ch] text-3xl font-light leading-[1.08] tracking-tight text-onyx dark:text-platinum xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl"
        >
          {{ contact.heading }}
        </h2>
        <Magnetic class="mt-10 md:mt-14">
          <a
            :href="`mailto:${contact.email}`"
            class="group inline-flex items-baseline gap-3 text-xl text-onyx dark:text-platinum sm:text-2xl md:text-3xl"
          >
            <span class="border-b border-current/30 pb-1">{{
              contact.email
            }}</span>
            <BobbingArrow direction="right" />
          </a>
        </Magnetic>
      </div>
    </ElementTracker>

    <!--
      The colophon. From md it is three columns — the copyright on the left,
      the links in the middle, "back to top" on the right — on a
      `1fr auto 1fr` grid, so the links sit on the page's centre line
      whatever the two sides measure. Below md it is a centred stack: the
      links, "back to top" under them, the copyright last and smallest
      (`order`), because a row of five things at phone width broke into two
      uneven lines, and at sm the side columns were too narrow for the
      copyright to stay on one line.
    -->
    <div
      class="mt-10 flex flex-col items-center gap-5 text-center text-base text-onyx/60 dark:text-platinum/60 md:mt-14 md:grid md:grid-cols-[1fr_auto_1fr] md:items-baseline md:gap-8"
    >
      <span
        class="order-3 whitespace-nowrap text-sm md:order-none md:justify-self-start md:text-base"
        >© {{ year }} {{ contact.name }}</span
      >
      <ul
        class="order-1 flex flex-wrap justify-center gap-x-8 gap-y-3 md:order-none"
      >
        <li v-for="link in contact.links" :key="link.to">
          <a
            :href="link.to"
            target="_blank"
            rel="noreferrer"
            class="text-onyx transition-colors hover:text-accent dark:text-platinum dark:hover:text-accent"
          >
            {{ link.label }}
          </a>
        </li>
      </ul>
      <a
        href="#main-content"
        class="group order-2 inline-flex items-baseline gap-2 whitespace-nowrap text-onyx dark:text-platinum md:order-none md:justify-self-end"
      >
        <span>{{ contact.backToTop }}</span>
        <BobbingArrow direction="up" />
      </a>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTrail } from '~/composables/useTrail'
import { plateStyle } from '~/utils/plate'
import { motion } from '~/motion.config'

// The panel rides the page trail; its light field follows by measuring it
const panel = ref<HTMLElement | null>(null)
useTrail(panel, motion.trail.footer)

// The same query the home page makes, so the two share one payload
const { data: home } = await useHomeContent()
const contact = computed(() => home.value?.contact)
const year = new Date().getFullYear()
</script>
