<template>
  <!--
    A dot on the pointer and a ring that trails it through a spring, both
    drawn in `difference` so they read on the light and the dark page alike.
    Each is its own fixed element with its own blend mode: a shared wrapper
    with opacity or a transform would isolate them from the page and the
    difference would have nothing to blend with.
  -->
  <template v-if="enabled">
    <div
      ref="dot"
      aria-hidden="true"
      class="cursor-dot pointer-events-none fixed left-0 top-0 z-[90]"
      :class="{ 'cursor-off': !visible }"
      :style="sizeVars"
    ></div>
    <div
      ref="ring"
      aria-hidden="true"
      class="cursor-ring pointer-events-none fixed left-0 top-0 z-[90]"
      :class="{ 'cursor-off': !visible }"
      :style="sizeVars"
    ></div>
    <span
      ref="label"
      aria-hidden="true"
      class="cursor-label pointer-events-none fixed left-0 top-0 z-[90]"
      :class="{ 'cursor-off': !visible || state !== 'view' }"
      >View</span
    >
  </template>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { gsap } from 'gsap'
import { useFrame } from '~/composables/useFrameLoop'
import { pointerFrame } from '~/composables/usePointer'
import { Spring } from '~/utils/spring'
import { motion } from '~/motion.config'

type CursorState = 'default' | 'link' | 'view'

const config = motion.cursor

/*
 * Off on the server and through hydration, on only for a fine pointer that
 * can hover: a finger never sees it, and the two renders always agree.
 */
const enabled = ref(false)
const visible = ref(false)
const state = ref<CursorState>('default')

const sizeVars = computed(() => ({
  '--cursor-dot': `${config.size.dot}px`,
  '--cursor-ring': `${config.size.ring}px`,
}))

const dot = ref<HTMLElement | null>(null)
const ring = ref<HTMLElement | null>(null)
const label = ref<HTMLElement | null>(null)

const ringX = new Spring(config.ring)
const ringY = new Spring(config.ring)
const ringScale = new Spring(config.scale, 1)

let reduced = false
let fine: MediaQueryList | null = null

type Setter = (value: number) => void
let setters: {
  dotX: Setter
  dotY: Setter
  ringX: Setter
  ringY: Setter
  ringScale: Setter
  labelX: Setter
  labelY: Setter
} | null = null

const scaleFor = (s: CursorState) =>
  s === 'view' ? config.size.view : s === 'link' ? config.size.link : 1

/*
 * One delegated listener: whatever the pointer is over decides the state.
 * Entering plain page from a link fires pointerover on that page element,
 * whose closest() finds nothing, so there is no pointerout bookkeeping.
 */
const onPointerOver = (event: Event) => {
  const target = event.target as Element | null
  const hit = target?.closest?.(
    '[data-cursor], a, button, [role="button"], [role="switch"]',
  )
  const named = hit?.getAttribute('data-cursor')
  state.value = named === 'view' ? 'view' : hit ? 'link' : 'default'
}

const applyCapability = () => {
  enabled.value = !!fine?.matches
  if (!enabled.value) {
    visible.value = false
    document.documentElement.classList.remove('cursor-custom')
    setters = null
  }
}

onMounted(() => {
  fine = window.matchMedia('(hover: hover) and (pointer: fine)')
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  applyCapability()
  fine.addEventListener('change', applyCapability)
  document.addEventListener('pointerover', onPointerOver, { passive: true })
})

// After a click that navigates no pointerover fires until the mouse moves,
// so the ring would stay enlarged over the new page
const stopRoute = useRouter().afterEach(() => {
  state.value = 'default'
})

onUnmounted(() => {
  fine?.removeEventListener('change', applyCapability)
  document.removeEventListener('pointerover', onPointerOver)
  document.documentElement.classList.remove('cursor-custom')
  stopRoute()
})

useFrame('render', (dt) => {
  if (!enabled.value) return
  const active = pointerFrame.active
  if (active !== visible.value) {
    visible.value = active
    // The native cursor goes only while ours is there to replace it
    document.documentElement.classList.toggle('cursor-custom', active)
  }
  if (!active) return

  // The elements arrive a tick after `enabled` flips
  if (!setters) {
    if (!dot.value || !ring.value || !label.value) return
    for (const el of [dot.value, ring.value, label.value])
      gsap.set(el, { xPercent: -50, yPercent: -50 })
    setters = {
      dotX: gsap.quickSetter(dot.value, 'x', 'px') as Setter,
      dotY: gsap.quickSetter(dot.value, 'y', 'px') as Setter,
      ringX: gsap.quickSetter(ring.value, 'x', 'px') as Setter,
      ringY: gsap.quickSetter(ring.value, 'y', 'px') as Setter,
      ringScale: gsap.quickSetter(ring.value, 'scale') as Setter,
      labelX: gsap.quickSetter(label.value, 'x', 'px') as Setter,
      labelY: gsap.quickSetter(label.value, 'y', 'px') as Setter,
    }
    // Start on the pointer rather than springing in from the corner
    ringX.set(pointerFrame.x)
    ringY.set(pointerFrame.y)
  }

  const { x, y } = pointerFrame
  const scale = scaleFor(state.value)
  if (reduced) {
    ringX.set(x)
    ringY.set(y)
    ringScale.set(scale)
  } else {
    ringX.target = x
    ringY.target = y
    ringScale.target = scale
    ringX.update(dt)
    ringY.update(dt)
    ringScale.update(dt)
  }

  setters.dotX(x)
  setters.dotY(y)
  setters.ringX(ringX.value)
  setters.ringY(ringY.value)
  setters.ringScale(ringScale.value)
  setters.labelX(ringX.value)
  setters.labelY(ringY.value)
})
</script>

<style scoped>
.cursor-dot,
.cursor-ring,
.cursor-label {
  mix-blend-mode: difference;
  will-change: transform;
  /* Overrides the global colour transition: only the fade is animated */
  transition: opacity 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.cursor-dot {
  width: var(--cursor-dot);
  height: var(--cursor-dot);
  border-radius: 9999px;
  background-color: #fff;
}

.cursor-ring {
  width: var(--cursor-ring);
  height: var(--cursor-ring);
  border-radius: 9999px;
  border: 1px solid #fff;
}

.cursor-label {
  color: #fff;
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  line-height: 1;
}

.cursor-off {
  opacity: 0;
}
</style>
