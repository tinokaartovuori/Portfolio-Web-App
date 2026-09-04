<template>
  <!--
    Everything below is plain DOM. ElementTracker and ThreeImage register the
    elements they wrap, and the WebGL layer measures those boxes — so content
    coming from markdown still ends up with a mesh, exactly as hand-written
    markup did.
  -->
  <!--
    The hero pads itself past the fixed bars (--bar-safe, see index.css) on
    both edges, so however short or narrow the viewport its text sits between
    the name and the scroll prompt rather than under either. When it still
    cannot fit, the scroll prompt is suppressed instead (see the script).
    On a phone in portrait the text sits in the lower part of the screen,
    above the scroll prompt, and the light field has the upper part; from
    md up it is centred.
  -->
  <ElementTracker threeReference="hero" object="LightField" variant="hero">
    <section
      ref="hero"
      class="flex min-h-[100svh] w-full items-end px-[8vw] pb-[calc(var(--bar-safe)_+_3.5rem)] pt-[calc(var(--bar-safe)_+_2.5rem)] sm:px-[10vw] md:items-center md:pb-[calc(var(--bar-safe)_+_2rem)]"
    >
      <div class="w-full">
        <h1
          class="max-w-[15ch] text-3xl font-light leading-[1.08] tracking-tight text-onyx dark:text-platinum xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl"
        >
          {{ home?.hero.lead }}
        </h1>
        <WaveText
          :text="home?.hero.accent ?? ''"
          class="mt-6 block text-lg font-light text-onyx/60 dark:text-platinum/60 sm:text-xl md:mt-8 md:text-2xl"
        />
        <Magnetic class="mt-12 md:mt-16">
          <a
            :href="home?.hero.cta.to"
            class="group inline-flex items-baseline gap-3 text-base text-onyx dark:text-platinum sm:text-lg md:text-xl"
          >
            <span
              aria-hidden="true"
              class="inline-block transition-transform duration-300 group-hover:translate-x-1"
              >→</span
            >
            <span class="border-b border-current/30 pb-1">{{
              home?.hero.cta.label
            }}</span>
          </a>
        </Magnetic>
      </div>
    </section>
  </ElementTracker>

  <Marquee v-if="home?.marquee" :words="home.marquee" />

  <section id="work" class="w-full px-[8vw] pb-40 pt-16 sm:px-[10vw] md:pt-24">
    <header ref="workHeader" class="mb-20 will-change-transform md:mb-28">
      <p
        class="mb-4 text-xs uppercase tracking-[0.18em] text-onyx/50 dark:text-platinum/50 sm:text-sm"
      >
        {{ home?.work.eyebrow }}
      </p>
      <h2
        class="max-w-[18ch] text-2xl font-light leading-tight tracking-tight text-onyx dark:text-platinum sm:text-3xl md:text-4xl"
      >
        {{ home?.work.heading }}
      </h2>
    </header>

    <ol class="flex flex-col gap-32 md:gap-44">
      <li v-for="(project, index) in projects" :key="project.id">
        <ProjectIndex
          :index="index"
          :threeReference="`shape-${project.stem}`"
          :flip="index % 2 === 0"
        />

        <div
          class="flex flex-col gap-8 md:flex-row md:items-start md:gap-16"
          :class="index % 2 === 1 ? 'md:flex-row-reverse' : ''"
        >
          <!-- The backdrop lights each image from its page-edge side; see Backdrop.ts -->
          <div class="w-full md:w-3/5">
            <NuxtLink
              :to="project.path"
              class="block"
              :aria-label="`View ${project.title}`"
            >
              <ThreeImage
                :threeReference="`project-${project.stem}`"
                :imageUrl="project.image"
                :alt="project.imageAlt"
              />
            </NuxtLink>
          </div>

          <div
            :ref="(el) => trailed(el, index)"
            class="flex w-full flex-col will-change-transform md:w-2/5 md:pt-2"
          >
            <p
              class="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-onyx/45 dark:text-platinum/45"
            >
              {{ project.year }} — {{ project.role }}
            </p>
            <h3
              class="text-xl font-normal tracking-tight text-onyx dark:text-platinum sm:text-2xl md:text-3xl"
            >
              {{ project.title }}
            </h3>
            <p
              class="mt-4 max-w-[42ch] text-base leading-relaxed text-onyx/70 dark:text-platinum/70 sm:text-lg"
            >
              {{ project.summary }}
            </p>
            <NuxtLink
              :to="project.path"
              class="group mt-8 inline-flex w-fit items-baseline gap-2 text-sm text-onyx dark:text-platinum sm:text-base"
            >
              <span class="border-b border-current/30 pb-1">Read more</span>
              <span
                aria-hidden="true"
                class="inline-block transition-transform duration-300 group-hover:translate-x-1"
                >→</span
              >
            </NuxtLink>
          </div>
        </div>
      </li>
    </ol>
  </section>

  <section
    v-if="about"
    ref="aboutTeaser"
    class="w-full px-[8vw] pb-24 will-change-transform sm:px-[10vw] md:pb-32 lg:px-[14vw]"
  >
    <p
      class="mb-6 text-xs uppercase tracking-[0.18em] text-onyx/50 dark:text-platinum/50 sm:text-sm"
    >
      {{ home?.about.eyebrow }}
    </p>
    <p
      class="max-w-[34ch] text-2xl font-light leading-snug tracking-tight text-onyx dark:text-platinum sm:text-3xl md:text-4xl"
    >
      {{ about.standfirst }}
    </p>
    <Magnetic class="mt-10">
      <NuxtLink
        to="/about"
        class="group inline-flex items-baseline gap-3 text-base text-onyx dark:text-platinum sm:text-lg"
      >
        <span class="border-b border-current/30 pb-1">{{
          home?.about.link
        }}</span>
        <span
          aria-hidden="true"
          class="inline-block transition-transform duration-300 group-hover:translate-x-1"
          >→</span
        >
      </NuxtLink>
    </Magnetic>
  </section>
</template>

<script setup lang="ts">
import { ref, watchEffect, onUnmounted } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useElementSize, useWindowSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useScrollStateStore } from '~/store/scrollState'
import { useTrail } from '~/composables/useTrail'
import { motion } from '~/motion.config'

/*
 * The page trail: headings and text columns lag their scroll position
 * through the same spring as the images, so the page moves as one body. The
 * image columns are left alone — their meshes carry the trail themselves.
 */
const workHeader = ref<HTMLElement | null>(null)
const aboutTeaser = ref<HTMLElement | null>(null)
useTrail(workHeader, motion.trail.heading)
useTrail(aboutTeaser, motion.trail.heading)

// One ref per project text column, created as the list renders
const textColumns = Array.from({ length: 8 }, () =>
  ref<HTMLElement | null>(null),
)
for (const column of textColumns) useTrail(column, motion.trail.text)
const trailed = (
  el: Element | ComponentPublicInstance | null,
  index: number,
) => {
  const column = textColumns[index]
  if (column) column.value = el instanceof HTMLElement ? el : null
}

const { scrollPromptSuppressed, heroHeight: storedHeroHeight } = storeToRefs(
  useScrollStateStore(),
)

// Declared before the first await, so it is in the store before any sibling
// mounts: the bars would otherwise show their veil over the hero for the
// first frames, until the hero's real height arrives
storedHeroHeight.value = Number.POSITIVE_INFINITY

const { data: home } = await useHomeContent()

/*
 * The hero is min-h-[100svh] with its text centred between the bar-safe
 * paddings, so it only grows past the viewport when the text cannot fit
 * (a landscape phone, a small window). The fixed scroll prompt would then
 * sit on the text, so it is switched off for as long as that is the case.
 */
const hero = ref<HTMLElement | null>(null)
// Border box: the padding is the whole point, so the content box would say
// the hero fits when its text is already under the bars
const { height: heroHeight } = useElementSize(hero, undefined, {
  box: 'border-box',
})
const { height: windowHeight } = useWindowSize()
watchEffect(() => {
  scrollPromptSuppressed.value =
    heroHeight.value > 0 && heroHeight.value > windowHeight.value + 1
  // The fixed bars fade their veil in once the hero has scrolled past them
  storedHeroHeight.value =
    heroHeight.value > 0 ? heroHeight.value : Number.POSITIVE_INFINITY
})

onUnmounted(() => {
  scrollPromptSuppressed.value = false
  storedHeroHeight.value = 0
})

const { data: projects } = await useAsyncData('projects', () =>
  queryCollection('projects').order('order', 'ASC').all(),
)

// The teaser shows the about page's standfirst
const { data: about } = await useAboutContent()

useSeoMeta({
  title: () => home.value?.title ?? 'Portfolio',
  description: () => home.value?.description,
  ogTitle: () => home.value?.title ?? 'Portfolio',
  ogDescription: () => home.value?.description,
})
</script>
