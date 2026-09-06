<template>
  <!--
    A heart and its count, set in the same type as the links beside it. The
    count is empty until it has been fetched, on the server and through
    hydration alike, so nothing is frozen into the page, and its box is the
    number's own width, so the gap to the switch is the bar's gap whatever
    the number is; the number itself is at most four characters ("1.2k",
    "123k", `formatCount`). A press pops the heart through a spring and
    leaves a ring behind; the number rolls up to the new one. All of it in
    the frame loop's render stage, off under reduced motion, where the fill
    and the number just change.

    Over the hero the heart stays in the text colour, hollow or filled; it
    takes the accent only once the bar has left the hero and sits over the
    page, where the rose reads against the page colour instead of the lights.
  -->
  <button
    type="button"
    class="like-button pointer-events-auto flex items-center gap-2 text-lg font-light text-onyx sm:gap-2.5 sm:text-xl md:text-2xl dark:text-platinum"
    :class="{ 'like-accent': liked && pastHero }"
    :aria-pressed="liked"
    :aria-label="liked ? 'Liked' : 'Like this site'"
    @click="onPress"
    @pointerenter="hover = true"
    @pointerleave="hover = false"
  >
    <span class="relative block size-[1.05em]">
      <span
        ref="ringElement"
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 rounded-full border border-current opacity-0"
      ></span>
      <svg
        ref="heartElement"
        viewBox="0 0 24 24"
        aria-hidden="true"
        class="size-full will-change-transform"
      >
        <path
          class="like-heart"
          :class="liked ? 'like-heart-on' : ''"
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
      </svg>
    </span>
    <span
      class="relative block h-[1.25em] overflow-hidden leading-[1.25em] tabular-nums"
      aria-live="polite"
    >
      <Transition name="roll">
        <span
          v-if="count !== null"
          :key="count"
          class="block whitespace-nowrap"
          :title="count.toLocaleString('en')"
        >
          {{ formatCount(count) }}
        </span>
      </Transition>
    </span>
  </button>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted } from 'vue'
import { useLikes } from '~/composables/useLikes'
import { useFrame, damp } from '~/composables/useFrameLoop'
import { BAR_PAST_HERO } from '~/composables/useBar'
import { Spring } from '~/utils/spring'
import { formatCount } from '~/utils/formatCount'
import { motion } from '~/motion.config'

const { count, liked, like } = useLikes()
const config = motion.like

// Outside a Bar (nowhere today) the heart is simply over the page
const pastHero = inject(
  BAR_PAST_HERO,
  computed(() => true),
)

const heartElement = ref<SVGElement | null>(null)
const ringElement = ref<HTMLElement | null>(null)
const hover = ref(false)

const scale = new Spring(config.popSpring, 1)
const hoverScale = new Spring(config.hoverSpring, 1)
// 0 at the press, approaching 1 as the ring grows and fades
let ring = 1
let fine = false
let reduced = false
let atRest = true

// Last values written, so a settled frame writes nothing
let lastScale = Number.NaN
let lastRingScale = Number.NaN
let lastRingOpacity = Number.NaN

const setScale = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000
  if (rounded === lastScale || !heartElement.value) return
  lastScale = rounded
  heartElement.value.style.transform = `scale(${rounded})`
}
const setRing = (scale: number, opacity: number) => {
  const el = ringElement.value
  if (!el) return
  const s = Math.round(scale * 1000) / 1000
  const o = Math.round(opacity * 1000) / 1000
  if (s !== lastRingScale) {
    lastRingScale = s
    el.style.transform = `scale(${s})`
  }
  if (o !== lastRingOpacity) {
    lastRingOpacity = o
    el.style.opacity = String(o)
  }
}

onMounted(() => {
  fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})

const onPress = () => {
  // A press on a heart already given still pops: the button answers the
  // hand, the count does not
  void like()
  if (reduced) return
  scale.value = config.pop
  scale.velocity = 0
  ring = 0
}

useFrame('render', (dt) => {
  if (reduced || !heartElement.value) return
  hoverScale.target = fine && hover.value ? 1 + config.hoverLift : 1

  const ringDone = ring > 0.985
  if (scale.settled && hoverScale.settled && ringDone) {
    if (!atRest) {
      atRest = true
      setScale(1)
      setRing(lastRingScale || 1, 0)
    }
    return
  }
  atRest = false

  scale.update(dt)
  hoverScale.update(dt)
  setScale(scale.value * hoverScale.value)

  if (!ringDone) {
    ring = damp(ring, 1, config.ringSmoothing, dt)
    setRing(1 + (config.ring - 1) * ring, 1 - ring)
  } else {
    setRing(lastRingScale || 1, 0)
  }
})
</script>

<style scoped>
/* Given and over the page: the heart and the count take the accent. Specific
   enough to win over the theme colour utilities, whichever order Tailwind
   emits them in; the global colour transition carries the change */
.like-button.like-accent {
  color: var(--color-accent);
}
.like-heart {
  fill: transparent;
  transition:
    fill 600ms cubic-bezier(0.4, 0, 0.2, 1),
    stroke 600ms cubic-bezier(0.4, 0, 0.2, 1);
}
.like-heart-on {
  fill: currentColor;
}

/* The number rolls: the old one up and out, the new one up and in */
.roll-enter-active,
.roll-leave-active {
  transition:
    transform 450ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity 450ms cubic-bezier(0.4, 0, 0.2, 1);
}
.roll-leave-active {
  position: absolute;
  inset: 0;
}
.roll-enter-from {
  transform: translateY(100%);
  opacity: 0;
}
.roll-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .like-heart,
  .roll-enter-active,
  .roll-leave-active {
    transition-duration: 1ms;
  }
}
</style>
