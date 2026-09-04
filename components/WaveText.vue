<template>
  <span
    class="whitespace-nowrap delay-[0ms] duration-[0ms]"
    @mouseenter="mouseIn = true"
    @mouseleave="mouseIn = false"
  >
    <!--
      Split into one element per letter for the wave, so the string is exposed
      once for assistive tech instead of being announced character by character.
    -->
    <span class="sr-only">{{ props.text }}</span>
    <span
      v-for="(letter, index) in props.text"
      ref="letterElements"
      :key="index"
      class="relative inline-block"
      aria-hidden="true"
      >{{ letter === ' ' ? NON_BREAKING_SPACE : letter }}</span
    >
  </span>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import { gsap } from 'gsap'

const props = defineProps({
  text: {
    type: String,
    required: true,
  },
  onHover: {
    type: Boolean,
    required: false,
    default: false,
  },
})

// A literal ' ' would collapse against the neighbouring inline-block letters
const NON_BREAKING_SPACE = '\u00a0'

const mouseIn = ref(false)
let animationPlaying = false

const reducedMotion = usePreferredReducedMotion()
const prefersReducedMotion = computed(() => reducedMotion.value === 'reduce')

const letterElements = ref<HTMLElement[]>([])

// Built on mount rather than in setup: creating a timeline wakes gsap's ticker,
// which during SSR would spin a timer in the render process for no reason.
let timeline: ReturnType<typeof gsap.timeline> | null = null

onMounted(() => {
  const created = gsap.timeline({
    paused: true,
    onComplete: () => {
      if (!props.onHover) return // if onHover is false
      if (mouseIn.value && !prefersReducedMotion.value) {
        created.play(0)
        animationPlaying = true
        return // Animation continued
      }
      // Animation stopped
      created.pause()
      animationPlaying = false
    },
  })

  // Put every letter in a timeline with 100ms delay from each
  letterElements.value.forEach((letterElement, index) => {
    // Creating an animation to timeline where opacity is pulsing from 1 to 0.5 and back up
    // Each letter has 100ms delay from each other
    created.to(
      letterElement,
      {
        opacity: 0.4,
        duration: 0.5,
        ease: 'power1.inOut',
      },
      index * 0.1,
    )
    created.to(
      letterElement,
      {
        opacity: 1,
        duration: 0.5,
        ease: 'power1.inOut',
      },
      index * 0.1 + 0.5,
    )
  })

  timeline = created

  // Nothing pulses for visitors who asked for reduced motion
  if (prefersReducedMotion.value) return

  // If onHover is false, repeat the animation forever
  if (!props.onHover) {
    created.repeat(-1)
    created.play(0)
    animationPlaying = true
  }
})

onUnmounted(() => {
  // gsap's root timeline holds on to this otherwise
  timeline?.kill()
  timeline = null
})

watch(mouseIn, (value) => {
  if (!value) return
  if (!props.onHover) return
  if (prefersReducedMotion.value) return
  if (animationPlaying) return
  // Start playing animation on hover
  timeline?.play(0)
  animationPlaying = true
})

// The preference can flip while the page is open
watch(prefersReducedMotion, (reduce) => {
  if (!timeline) return
  if (reduce) {
    // Rewinding restores every letter to full opacity
    timeline.pause(0)
    animationPlaying = false
    return
  }
  if (props.onHover) return
  timeline.repeat(-1)
  timeline.play(0)
  animationPlaying = true
})
</script>
