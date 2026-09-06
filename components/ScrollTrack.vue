<!--
  The visible scroll affordance, and a scrollbar: the OS one is hidden in CSS.
  The thin track sits in a wider invisible hit area so it can be grabbed.
  Dragging the indicator writes the position straight to the window — the
  integrator adopts a position it did not write as the new truth, so the page
  follows the pointer 1:1 instead of chasing it through the spring — and a
  press on the track away from the indicator glides there through the spring,
  the way an anchor does. Pointer-only, so it stays out of the accessibility
  tree; the keyboard has its own scrolling.

  The indicator has no height until the first frame publishes the page's
  length, so it fades in on the page's reveal envelope rather than appearing.
-->
<template>
  <div
    ref="track"
    aria-hidden="true"
    class="group fixed bottom-0 right-0 top-0 z-40 w-4 touch-none select-none"
    :class="dragging ? 'cursor-grabbing' : 'cursor-grab'"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerEnd"
    @pointercancel="onPointerEnd"
  >
    <div
      class="absolute bottom-0 right-0 top-0 w-0.5 bg-onyx/15 transition-[width] duration-200 group-hover:w-1.5 dark:bg-platinum/20 xs:w-1 sm:w-1.5 sm:group-hover:w-2.5"
      :class="dragging && 'w-1.5 sm:w-2.5'"
    >
      <div
        ref="indicator"
        class="absolute inset-x-0 top-0 rounded-full bg-accent opacity-0"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useWindowSize } from '@vueuse/core'
import { useScrollStateStore } from '~/store/scrollState'
import { onFrame } from '~/composables/useFrameLoop'
import { glideTo } from '~/composables/useSmoothScroll'
import { revealFrame, ease, startPageReveal } from '~/composables/useReveal'
const scrollStateStore = useScrollStateStore()
const { scrollY, scrollYMax } = storeToRefs(scrollStateStore)

const track = ref<HTMLElement | null>(null)
const indicator = ref<HTMLElement | null>(null)

const { height: windowHeight } = useWindowSize()

// Cached so the per frame update only has to write the indicator position
let trackHeight = 0
let indicatorHeight = 0
let lastY = Number.NaN
let lastOpacity = Number.NaN
let stopFrame: (() => void) | null = null

/* scrollYMax is 0 before the first scroll event and after every navigation,
 * so the indicator is collapsed instead of dividing by zero. */
const updateIndicatorHeight = () => {
  if (!track.value || !indicator.value) return
  trackHeight = track.value.clientHeight
  /* Indicator height is ratio of track height to scrollYMax, capped at the
   * track: a page only just longer than the viewport asks for an indicator
   * several screens tall, which then also drags itself off the top of the
   * track once (trackHeight - indicatorHeight) goes negative. */
  indicatorHeight =
    scrollYMax.value > 0
      ? Math.min(
          ((trackHeight / scrollYMax.value) * trackHeight) / 2,
          trackHeight,
        )
      : 0
  indicator.value.style.height = `${indicatorHeight}px`
}

/** Where the indicator's top sits for a scroll position, track px. */
const indicatorTopFor = (y: number) =>
  (y / scrollYMax.value) * (trackHeight - indicatorHeight)

const updateIndicatorPosition = () => {
  const el = indicator.value
  if (!el || scrollYMax.value <= 0) return
  const y = Math.round(indicatorTopFor(scrollY.value) * 10) / 10
  if (y !== lastY) {
    lastY = y
    el.style.transform = `translate3d(0, ${y}px, 0)`
  }
  const opacity = Math.round(ease(revealFrame.page) * 1000) / 1000
  if (opacity !== lastOpacity) {
    lastOpacity = opacity
    el.style.opacity = String(opacity)
  }
}

watch([scrollYMax, windowHeight], () => {
  updateIndicatorHeight()
  updateIndicatorPosition()
})

/*
 * The drag: scroll px per track px is the ratio of the two travels, so the
 * indicator stays under the pointer. Captured, so it keeps following once
 * the pointer leaves the hit area.
 */
const dragging = ref(false)
let dragStartY = 0
let dragStartScroll = 0
let dragPointer = -1

const scrollPerTrackPx = () => {
  const travel = trackHeight - indicatorHeight
  return travel > 0 ? scrollYMax.value / travel : 0
}

const onPointerDown = (event: PointerEvent) => {
  if (!track.value || scrollYMax.value <= 0) return
  if (event.button !== 0) return
  event.preventDefault()

  const trackTop = track.value.getBoundingClientRect().top
  const pointerY = event.clientY - trackTop
  const top = indicatorTopFor(scrollY.value)

  if (pointerY < top || pointerY > top + indicatorHeight) {
    // Off the indicator: glide so it centres under the pointer
    glideTo((pointerY - indicatorHeight / 2) * scrollPerTrackPx())
    return
  }

  dragging.value = true
  dragPointer = event.pointerId
  dragStartY = event.clientY
  dragStartScroll = scrollY.value
  track.value.setPointerCapture(event.pointerId)
}

const onPointerMove = (event: PointerEvent) => {
  if (!dragging.value || event.pointerId !== dragPointer) return
  const y = dragStartScroll + (event.clientY - dragStartY) * scrollPerTrackPx()
  window.scrollTo(0, Math.max(0, Math.min(scrollYMax.value, y)))
}

const onPointerEnd = (event: PointerEvent) => {
  if (!dragging.value || event.pointerId !== dragPointer) return
  dragging.value = false
  dragPointer = -1
  track.value?.releasePointerCapture(event.pointerId)
}

onMounted(() => {
  startPageReveal()
  updateIndicatorHeight()
  updateIndicatorPosition()
  // Runs in the shared frame loop's render stage, after scroll has advanced
  stopFrame = onFrame('render', updateIndicatorPosition)
})

onUnmounted(() => {
  stopFrame?.()
  stopFrame = null
})
</script>

<style scoped></style>
