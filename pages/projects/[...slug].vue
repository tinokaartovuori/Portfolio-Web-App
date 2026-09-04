<template>
  <article
    v-if="project"
    class="w-full px-[8vw] pb-40 pt-40 text-onyx dark:text-platinum sm:px-[10vw] md:pt-48 lg:px-[14vw]"
  >
    <p
      class="mb-5 font-mono text-xs uppercase tracking-[0.14em] text-onyx/45 dark:text-platinum/45"
    >
      {{ project.year }} — {{ project.role }}
    </p>

    <h1
      class="max-w-[16ch] text-3xl font-light leading-[1.1] tracking-tight xs:text-4xl sm:text-5xl md:text-6xl"
    >
      {{ project.title }}
    </h1>

    <p
      class="mt-10 max-w-[46ch] text-lg font-light leading-relaxed text-onyx/70 dark:text-platinum/70 sm:text-xl md:mt-14 md:text-2xl"
    >
      {{ project.summary }}
    </p>

    <div class="mt-20 md:mt-28">
      <ThreeImage
        :threeReference="`project-detail-${project.stem}`"
        :imageUrl="project.image"
        :alt="project.imageAlt"
      />
    </div>

    <div class="prose-body mt-20 max-w-[62ch] md:mt-28">
      <ContentRenderer :value="project" />
    </div>

    <NuxtLink
      to="/#work"
      class="group mt-24 inline-flex w-fit items-baseline gap-3 text-sm sm:text-base"
    >
      <span
        aria-hidden="true"
        class="inline-block transition-transform duration-300 group-hover:-translate-x-1"
        >←</span
      >
      <span class="border-b border-current/30 pb-1">All work</span>
    </NuxtLink>
  </article>
</template>

<script setup lang="ts">
const route = useRoute()

const { data: project } = await useAsyncData(`project-${route.path}`, () =>
  queryCollection('projects').path(route.path).first(),
)

if (!project.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Project not found',
    fatal: true,
  })
}

useSeoMeta({
  title: () => project.value?.title,
  description: () => project.value?.summary,
  ogTitle: () => project.value?.title,
  ogDescription: () => project.value?.summary,
  ogImage: () => project.value?.image,
})
</script>

<style scoped>
.prose-body :deep(p) {
  margin-bottom: 1.6em;
  font-size: 1.0625rem;
  line-height: 1.75;
  color: color-mix(in srgb, currentColor 78%, transparent);
}

.prose-body :deep(p:last-child) {
  margin-bottom: 0;
}
</style>
