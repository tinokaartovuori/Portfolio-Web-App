<template>
  <!--
    On every page, inside ScrollContainer: it contains nothing fixed, so it
    rides the rubber band like the rest of the document, and its light field
    follows because the mesh measures the translated box.
  -->
  <footer
    v-if="contact"
    class="w-full px-[8vw] pb-10 pt-24 text-onyx sm:px-[10vw] md:pb-14 md:pt-32"
  >
    <ElementTracker
      threeReference="footer-lights"
      object="LightField"
      variant="footer"
    >
      <div
        class="relative flex flex-col items-start px-[6vw] py-20 sm:px-[8vw] md:py-28"
      >
        <p
          class="mb-6 text-xs uppercase tracking-[0.18em] text-onyx/50 dark:text-platinum/50 sm:text-sm"
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
            class="group inline-flex items-baseline gap-3 text-lg text-onyx dark:text-platinum sm:text-xl md:text-2xl"
          >
            <span class="border-b border-current/30 pb-1">{{
              contact.email
            }}</span>
            <span
              aria-hidden="true"
              class="inline-block transition-transform duration-300 group-hover:translate-x-1"
              >→</span
            >
          </a>
        </Magnetic>
      </div>
    </ElementTracker>

    <div
      class="mt-10 flex flex-col gap-6 text-sm text-onyx/60 dark:text-platinum/60 sm:flex-row sm:items-center sm:justify-between md:mt-14"
    >
      <ul class="flex gap-6">
        <li v-for="link in contact.links" :key="link.to">
          <a
            :href="link.to"
            target="_blank"
            rel="noreferrer"
            class="text-onyx transition-colors hover:text-pink-500 dark:text-platinum dark:hover:text-pink-500"
          >
            {{ link.label }}
          </a>
        </li>
      </ul>
      <div class="flex items-center gap-6">
        <span>© {{ year }} {{ contact.name }}</span>
        <a
          href="#main-content"
          class="group inline-flex items-baseline gap-2 text-onyx dark:text-platinum"
        >
          <span>{{ contact.backToTop }}</span>
          <span
            aria-hidden="true"
            class="inline-block transition-transform duration-300 group-hover:-translate-y-0.5"
            >↑</span
          >
        </a>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// The same query the home page makes, so the two share one payload
const { data: home } = await useHomeContent()
const contact = computed(() => home.value?.contact)
const year = new Date().getFullYear()
</script>
