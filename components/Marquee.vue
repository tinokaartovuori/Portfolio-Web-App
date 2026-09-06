<template>
  <!--
    A running band of words. The list is read once by assistive technology;
    the moving track is decoration, so it is hidden from it and holds the
    words twice, which is what lets it loop seamlessly.
  -->
  <div class="w-full overflow-hidden py-8 md:py-12" :aria-label="label">
    <ul class="sr-only">
      <li v-for="word in words" :key="word">{{ word }}</li>
    </ul>
    <div
      ref="track"
      aria-hidden="true"
      class="flex w-max items-center whitespace-nowrap will-change-transform"
    >
      <span
        v-for="(word, i) in doubled"
        :key="i"
        class="flex items-center text-3xl font-light tracking-tight text-onyx/55 dark:text-platinum/55 sm:text-4xl md:text-5xl lg:text-6xl"
      >
        {{ word }}
        <span
          class="mx-6 inline-block h-2 w-2 rounded-full bg-accent sm:mx-8 md:mx-10 md:h-2.5 md:w-2.5"
        ></span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useElementSize } from '@vueuse/core'
import { useFrame } from '~/composables/useFrameLoop'
import { scrollFrame } from '~/composables/useSmoothScroll'
import { ScrollFeel } from '~/utils/scrollFeel'
import { motion } from '~/motion.config'

const props = withDefaults(
  defineProps<{
    words: string[]
    /** Accessible name for the band as a whole. */
    label?: string
  }>(),
  { label: 'Skills' },
)

const config = motion.marquee

const doubled = computed(() => [...props.words, ...props.words])
const track = ref<HTMLElement | null>(null)
const { width } = useElementSize(track)

const feel = new ScrollFeel(motion.scrollFeel)
let reduced = false
let x = 0
let lastX = Number.NaN
let lastSkew = Number.NaN

onMounted(() => {
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})

/*
 * The band runs on its own and the scroll adds to it: scrolling down speeds
 * it up, scrolling up slows or reverses it, and a fast scroll leans it over.
 * Under reduced motion it is a static row.
 */
useFrame('render', (dt) => {
  if (reduced || !track.value) return
  const half = width.value / 2
  if (!half) return

  feel.update(scrollFrame.velocity, dt)
  const speed = Math.max(
    -config.maxSpeed,
    Math.min(
      config.maxSpeed,
      config.baseSpeed + feel.velocity * config.velocityGain,
    ),
  )
  // Wrap within [-half, 0): the second copy of the words takes over exactly
  // where the first one left
  x = ((((x - speed * dt) % half) + half) % half) - half

  // Written to hundredths: the band moves every frame, but the skew settles
  const px = Math.round(x * 100) / 100
  const skew = Math.round(feel.drive * config.skew * 100) / 100
  if (px === lastX && skew === lastSkew) return
  lastX = px
  lastSkew = skew
  track.value.style.transform = `translate3d(${px}px, 0, 0) skewX(${skew}deg)`
})
</script>
