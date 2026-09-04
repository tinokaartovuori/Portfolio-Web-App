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
  -->
  <ElementTracker threeReference="hero" object="IntroRectangle">
    <section
      ref="hero"
      class="flex min-h-[100svh] w-full items-center px-[8vw] pb-[calc(var(--bar-safe)_+_2rem)] pt-[calc(var(--bar-safe)_+_2.5rem)] sm:px-[10vw]"
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
        <a
          :href="home?.hero.cta.to"
          class="group mt-12 inline-flex items-baseline gap-3 text-base text-onyx dark:text-platinum sm:text-lg md:mt-16 md:text-xl"
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
      </div>
    </section>
  </ElementTracker>

  <section id="work" class="w-full px-[8vw] pb-40 sm:px-[10vw]">
    <header class="mb-20 md:mb-28">
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
      <li
        v-for="(project, index) in projects"
        :key="project.id"
        class="flex flex-col gap-8 md:flex-row md:items-start md:gap-16"
        :class="index % 2 === 1 ? 'md:flex-row-reverse' : ''"
      >
        <div class="w-full md:w-3/5">
          <ThreeImage
            :threeReference="`project-${project.stem}`"
            :imageUrl="project.image"
            :alt="project.imageAlt"
          />
        </div>

        <div class="flex w-full flex-col md:w-2/5 md:pt-2">
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
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { ref, watchEffect, onUnmounted } from 'vue'
import { useElementSize, useWindowSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useScrollStateStore } from '~/store/scrollState'

const { scrollPromptSuppressed, heroHeight: storedHeroHeight } = storeToRefs(
  useScrollStateStore(),
)

// Declared before the first await, so it is in the store before any sibling
// mounts: the bars would otherwise show their veil over the hero for the
// first frames, until the hero's real height arrives
storedHeroHeight.value = Number.POSITIVE_INFINITY

const { data: home } = await useAsyncData('home', () =>
  queryCollection('home').first(),
)

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

useSeoMeta({
  title: () => home.value?.title ?? 'Portfolio',
  description: () => home.value?.description,
  ogTitle: () => home.value?.title ?? 'Portfolio',
  ogDescription: () => home.value?.description,
})
</script>
