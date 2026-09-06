<template>
  <span
    class="delay-[0ms] duration-[0ms]"
    @mouseenter="mouseIn = true"
    @mouseleave="mouseIn = false"
  >
    <!--
      Split into one element per letter for the wave, so the string is exposed
      once for assistive tech instead of being announced character by character.
      The letters of a word are held together in a nowrap word, and the words
      are separated by ordinary spaces, so the line wraps between words like
      any text: a nowrap line was what widened the page on a 360px phone.
    -->
    <span class="sr-only">{{ props.text }}</span>
    <template v-for="(word, wordIndex) in words" :key="wordIndex">
      {{ wordIndex > 0 ? ' ' : '' }}
      <span class="inline-block whitespace-nowrap" aria-hidden="true">
        <span
          v-for="letter in word"
          :key="letter.index"
          :ref="(el) => setLetter(letter.index, el as HTMLElement | null)"
          class="relative inline-block"
          >{{ letter.char }}</span
        >
      </span>
    </template>
  </span>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import { useFrame } from '~/composables/useFrameLoop'

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

/** The words, each letter numbered through the whole string for the stagger */
const words = computed(() => {
  let index = 0
  return props.text
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => Array.from(word, (char) => ({ char, index: index++ })))
})
const letterCount = computed(() =>
  words.value.reduce((count, word) => count + word.length, 0),
)

/*
 * The wave: each letter dims to `LOW` and back over `PULSE` seconds, starting
 * `STAGGER` after the one before it; one pass is over once the last letter
 * has come back up. Without `onHover` it repeats for as long as the page is
 * open; with it, a pass starts on mouseenter and the wave keeps going while
 * the pointer stays.
 */
const LOW = 0.4
const PULSE = 1
const STAGGER = 0.1

const mouseIn = ref(false)
const reducedMotion = usePreferredReducedMotion()
const prefersReducedMotion = computed(() => reducedMotion.value === 'reduce')

/** The letter elements by index; nested v-for refs keep no order of their own */
const letters: HTMLElement[] = []
const setLetter = (index: number, el: HTMLElement | null) => {
  if (el) letters[index] = el
}

/** Seconds into the current pass, or -1 while still. */
let local = -1
const last: number[] = []

const passLength = () => (letterCount.value - 1) * STAGGER + PULSE

const ease = (t: number) => t * t * (3 - 2 * t)

function writeOpacities(time: number) {
  for (let i = 0; i < letters.length; i++) {
    const x = time - i * STAGGER
    let dim = 0
    if (x > 0 && x < PULSE) {
      const half = PULSE / 2
      dim = x < half ? ease(x / half) : 1 - ease((x - half) / half)
    }
    const opacity = Math.round((1 - (1 - LOW) * dim) * 1000) / 1000
    if (last[i] === opacity) continue
    last[i] = opacity
    letters[i]!.style.opacity = String(opacity)
  }
}

function rest() {
  local = -1
  writeOpacities(-1)
}

useFrame('render', (dt) => {
  if (prefersReducedMotion.value) {
    if (local >= 0) rest()
    return
  }
  if (local < 0) {
    // Start a pass: always without onHover, on the pointer with it
    if (props.onHover && !mouseIn.value) return
    local = 0
  }
  local += dt
  if (local >= passLength()) {
    // A pass is over: go again, unless this is a hover wave and the pointer
    // has left
    if (props.onHover && !mouseIn.value) {
      rest()
      return
    }
    local -= passLength()
  }
  writeOpacities(local)
})

// Nothing pulses for visitors who asked for reduced motion
watch(prefersReducedMotion, (reduce) => {
  if (reduce) rest()
})
</script>
