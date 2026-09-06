<template>
  <!--
    The text is set to the left with room on the right, on purpose, but not
    the whole right half: the gutter narrows to 12vw from lg and the columns
    are measured in ch of a body size a fifth larger than the home page's
    cards, so the prose runs to about two thirds of the width on a laptop.
  -->
  <article
    v-if="project"
    class="w-full px-(--page-gutter) pb-24 pt-40 text-onyx dark:text-platinum md:pb-32 md:pt-48 lg:px-[12vw]"
  >
    <p
      class="mb-5 font-mono text-sm uppercase tracking-[0.14em] text-onyx/45 dark:text-platinum/45"
    >
      <time :datetime="project.year">{{ project.year }}</time> —
      {{ project.role }}
    </p>

    <h1
      class="max-w-[16ch] text-4xl font-light leading-[1.1] tracking-tight xs:text-5xl sm:text-6xl md:text-7xl"
    >
      {{ project.title }}
    </h1>

    <p
      class="mt-10 max-w-[46ch] text-xl font-light leading-relaxed text-onyx/70 dark:text-platinum/70 sm:text-2xl md:mt-14 md:text-3xl"
    >
      {{ project.summary }}
    </p>

    <!--
      Under the summary: the store rating and the project's own site on one
      line — the thing itself — and the links (the stores, a repository, a
      video) on the line below it, where to get it, each with the marks its
      content gives it (ProjectLink).
    -->
    <div
      v-if="project.rating || project.website || project.links?.length"
      class="mt-8 flex flex-col gap-y-3 text-base sm:text-lg"
    >
      <p
        v-if="project.rating || project.website"
        class="flex flex-wrap items-baseline gap-x-8 gap-y-3"
      >
        <Rating
          v-if="project.rating"
          :value="project.rating.value"
          :source="project.rating.source"
        />
        <a
          v-if="project.website"
          :href="project.website"
          target="_blank"
          rel="noopener"
          class="group inline-flex items-baseline gap-2 text-onyx dark:text-platinum"
        >
          <span class="border-b border-current/30 pb-1">{{
            websiteLabel
          }}</span>
          <BobbingArrow direction="up-right" />
        </a>
      </p>
      <ul
        v-if="project.links?.length"
        class="flex flex-wrap items-baseline gap-x-8 gap-y-3"
      >
        <li v-for="link in project.links" :key="link.to">
          <ProjectLink
            :to="link.to"
            :label="link.label"
            :icon="link.icon"
            :lang="link.lang"
          />
        </li>
      </ul>
    </div>

    <div class="mt-20 md:mt-28">
      <ThreeImage
        :threeReference="`project-detail-${project.stem}`"
        :imageUrl="project.image"
        :alt="project.imageAlt"
        sizes="(min-width: 640px) 80vw, 100vw"
        priority
      />
    </div>

    <div class="prose-body mt-20 max-w-[64ch] md:mt-28">
      <ContentRenderer :value="project" />
    </div>

    <!--
      The gallery: more images with the same treatment as the lead one. Two
      columns from md up (one on a phone), a `wide` item across both; a
      portrait and a landscape image keep their own aspect (the img is w-full
      h-auto), and the meshes measure whatever the grid lays out. With
      `galleryColumns: 3` — stills from a film, meant to be seen small — it
      is three columns from md and two on a phone, closer set, and `wide`
      spans two of them at every size, so five stills fill both rows.
    -->
    <section v-if="project.gallery?.length" class="mt-20 md:mt-28">
      <h2
        v-if="project.galleryTitle"
        class="mb-8 text-sm uppercase tracking-[0.18em] text-onyx/50 dark:text-platinum/50 sm:text-base"
      >
        {{ project.galleryTitle }}
      </h2>
      <ul
        class="grid"
        :class="
          small
            ? 'grid-cols-2 gap-4 md:grid-cols-3 md:gap-6'
            : 'grid-cols-1 gap-8 md:grid-cols-2 md:gap-10'
        "
      >
        <li
          v-for="(item, i) in project.gallery"
          :key="item.image"
          :class="item.wide ? (small ? 'col-span-2' : 'md:col-span-2') : ''"
        >
          <ThreeImage
            :threeReference="`project-gallery-${project.stem}-${i}`"
            :imageUrl="item.image"
            :alt="item.imageAlt"
            :sizes="
              small
                ? item.wide
                  ? '(min-width: 768px) 54vw, 100vw'
                  : '(min-width: 768px) 27vw, 50vw'
                : item.wide
                  ? '(min-width: 640px) 80vw, 100vw'
                  : '(min-width: 768px) 40vw, 100vw'
            "
          />
        </li>
      </ul>
    </section>

    <!--
      The way on: the next project in home page order (the first again after
      the last) and the way back to the index, under a rule like the index's
      own. On a phone the two stack, the next project first; from sm they
      share a row, "All work" on the left. "All work" alone at the foot of a
      phone's column of prose read as an orphan.
    -->
    <nav
      aria-label="More work"
      class="mt-20 flex flex-col gap-8 border-t border-onyx/30 pt-8 text-base dark:border-platinum/30 sm:flex-row-reverse sm:items-end sm:justify-between sm:text-lg md:mt-28 md:pt-10"
    >
      <NuxtLink
        v-if="next"
        :to="next.path"
        class="group flex flex-col items-start gap-3 sm:items-end"
      >
        <span
          class="font-mono text-sm uppercase tracking-[0.14em] text-onyx/45 dark:text-platinum/45"
        >
          Next
        </span>
        <span
          class="inline-flex items-baseline gap-3 text-2xl font-light leading-tight tracking-tight sm:text-3xl"
        >
          <span class="border-b border-current/30 pb-1">{{ next.title }}</span>
          <BobbingArrow direction="right" />
        </span>
      </NuxtLink>
      <NuxtLink
        to="/#work"
        class="group inline-flex w-fit items-baseline gap-3"
      >
        <BobbingArrow direction="left" />
        <span class="border-b border-current/30 pb-1">All work</span>
      </NuxtLink>
    </nav>
  </article>
</template>

<script setup lang="ts">
// No hero here: the bars render their scrolled state from the server (Bar.vue)
definePageMeta({ hero: false })

import { computed } from 'vue'

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

// The next project in home page order, wrapping round after the last one
const { data: projects } = await useProjects()
const next = computed(() => {
  const list = projects.value ?? []
  const i = list.findIndex((p) => p.path === route.path)
  return list.length > 1 && i >= 0 ? list[(i + 1) % list.length] : null
})

/** A gallery of stills is set small: three columns, two on a phone. */
const small = computed(() => project.value?.galleryColumns === 3)

/** The site's address as its label: the host, without the scheme or a www. */
const websiteLabel = computed(() => {
  const site = project.value?.website
  if (!site) return ''
  try {
    return new URL(site).hostname.replace(/^www\./, '')
  } catch {
    return site
  }
})

const { absolute } = useSiteUrl()

if (project.value) {
  const p = project.value
  useSeo({
    title: p.title,
    description: p.summary,
    path: route.path,
    image: p.image,
    imageAlt: p.imageAlt,
    type: 'article',
  })
  useJsonLd(
    buildProjectGraph(
      {
        title: p.title,
        summary: p.summary,
        image: p.image,
        imageAlt: p.imageAlt,
        path: route.path,
        year: p.year,
        date: p.date,
        duration: p.duration,
        schemaType: p.schemaType,
        operatingSystem: p.operatingSystem,
        website: p.website,
        rating: p.rating,
        links: p.links,
        gallery: p.gallery,
      },
      absolute,
    ),
  )
}
</script>

<style scoped>
.prose-body :deep(p),
.prose-body :deep(ul) {
  margin-bottom: 1.6em;
  font-size: 1.275rem;
  line-height: 1.7;
  color: color-mix(in srgb, currentColor 78%, transparent);
}

.prose-body :deep(li) {
  padding-left: 1.2em;
  text-indent: -1.2em;
}

.prose-body :deep(li)::before {
  content: '–';
  display: inline-block;
  width: 1.2em;
  text-indent: 0;
  color: color-mix(in srgb, currentColor 50%, transparent);
}

.prose-body :deep(p:last-child) {
  margin-bottom: 0;
}
</style>
