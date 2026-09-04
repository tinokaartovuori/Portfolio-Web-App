<template>
  <article
    class="w-full px-[8vw] pb-40 pt-40 text-onyx dark:text-platinum sm:px-[10vw] md:pt-48 lg:px-[14vw]"
  >
    <h1
      class="max-w-[16ch] text-3xl font-light leading-[1.1] tracking-tight text-onyx dark:text-platinum xs:text-4xl sm:text-5xl md:text-6xl"
    >
      {{ about?.title }}
    </h1>

    <p
      class="mt-10 max-w-[46ch] text-lg font-light leading-relaxed text-onyx/70 dark:text-platinum/70 sm:text-xl md:mt-14 md:text-2xl"
    >
      {{ about?.standfirst }}
    </p>

    <div class="prose-body mt-20 max-w-[62ch] md:mt-28">
      <ContentRenderer v-if="about" :value="about" />
    </div>
  </article>
</template>

<script setup lang="ts">
const { data: about } = await useAsyncData('about', () =>
  queryCollection('about').first(),
)

useSeoMeta({
  title: () => about.value?.title ?? 'About',
  description: () => about.value?.description,
  ogTitle: () => about.value?.title ?? 'About',
  ogDescription: () => about.value?.description,
})
</script>

<style scoped>
/*
 * Scoped rather than a Tailwind typography plugin: the body is a handful of
 * elements and the plugin's own colour scale would have to be overridden for
 * both themes anyway.
 */
.prose-body :deep(p) {
  margin-bottom: 1.6em;
  font-size: 1.0625rem;
  line-height: 1.75;
  color: color-mix(in srgb, currentColor 78%, transparent);
}

.prose-body :deep(h2) {
  margin-top: 2.8em;
  margin-bottom: 0.9em;
  font-size: 0.8125rem;
  font-weight: 400;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: color-mix(in srgb, currentColor 50%, transparent);
}

.prose-body :deep(a) {
  color: inherit;
  border-bottom: 1px solid color-mix(in srgb, currentColor 35%, transparent);
}

.prose-body :deep(p:last-child) {
  margin-bottom: 0;
}
</style>
