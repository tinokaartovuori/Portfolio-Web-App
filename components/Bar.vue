<template>
  <!--
    The document scrolls underneath the fixed bars now, so this full-width
    transparent band would otherwise swallow every click on the content passing
    below it. The controls inside opt back in individually.
  -->
  <div
    class="bar-slide pointer-events-none fixed inset-x-0 z-50"
    :class="[
      edge === 'top' ? 'top-(--bar-offset)' : 'bottom-(--bar-offset)',
      compactOn ? 'bar-compact' : '',
    ]"
  >
    <!--
      The veil reaches from the viewport edge to well past the bar and fades
      out with a long feather, so content passing under the bar dissolves
      instead of colliding with it. It sits under the bar's contents and over
      the page, and stays off while the bar is over the hero (see below).
    -->
    <div
      ref="veilElement"
      aria-hidden="true"
      class="bar-veil absolute inset-x-0"
      :class="[
        edge === 'top'
          ? 'top-[calc(-1_*_var(--bar-offset))]'
          : 'bar-veil-bottom bottom-[calc(-1_*_var(--bar-offset))]',
        veilOn ? 'bar-veil-on' : '',
      ]"
    ></div>
    <div class="relative flex w-full justify-center">
      <div class="flex w-[75%] items-center justify-end xs:w-[85%]">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useElementBounding, useWindowSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useScrollStateStore } from '~/store/scrollState'

const props = withDefaults(
  defineProps<{
    /** Which viewport edge the bar hangs from. */
    edge?: 'top' | 'bottom'
    /** Whether the feathered backdrop may show at all. */
    veil?: boolean
    /**
     * Slide to `--bar-offset-compact` once past the hero, to give the page
     * more room. Top bars only.
     */
    compact?: boolean
  }>(),
  {
    edge: 'top',
    veil: true,
    compact: false,
  },
)

const veilElement = ref<HTMLElement | null>(null)
// The bar is fixed, so its box only changes with the viewport, never with
// scrolling; skip the per-scroll-event updates
const { bottom: veilBottom } = useElementBounding(veilElement, {
  windowScroll: false,
})
const { height: viewportHeight } = useWindowSize()

const { scrollY, heroHeight } = storeToRefs(useScrollStateStore())

/*
 * The hero view stays clean: no veil while the bar is over the hero. The top
 * veil waits until the hero has scrolled up past the veil's bottom edge, so it
 * fades in as the first content passes under the bar; the bottom veil only
 * has to wait for the hero's bottom edge to leave the viewport, which is the
 * moment scrolling starts. A page without a hero has both on from the start.
 */
const overHero = computed(() => {
  if (heroHeight.value === 0) return false
  const heroBottom = heroHeight.value - scrollY.value
  const threshold =
    props.edge === 'top' ? veilBottom.value : viewportHeight.value - 1
  return heroBottom > threshold
})

/*
 * Off until mounted, on the server and through hydration alike: the layout
 * renders the bars before the page's setup has said whether it has a hero,
 * and a server-rendered "on" would be left in place by hydration (class
 * mismatches are check-only) until the next re-render. Pages without a hero
 * get a short fade-in instead, which reads as intended.
 */
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

const pastHero = computed(() => mounted.value && !overHero.value)
const veilOn = computed(() => props.veil && pastHero.value)
const compactOn = computed(
  () => props.compact && props.edge === 'top' && pastHero.value,
)
</script>
