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
      aria-hidden="true"
      class="bar-veil absolute inset-x-0"
      :class="[
        edge === 'top'
          ? 'top-[calc(-1_*_var(--bar-offset))]'
          : 'bar-veil-bottom bottom-[calc(-1_*_var(--bar-offset))]',
        veilOn ? 'bar-veil-on' : '',
      ]"
    ></div>
    <!--
      A deeper wash for when the top bar has a menu open over the page: solid
      to below the open stack, then feathered. Its own layer, faded in and
      out, because a mask cannot be transitioned.
    -->
    <div
      v-if="edge === 'top'"
      aria-hidden="true"
      class="bar-veil bar-shade absolute inset-x-0 top-[calc(-1_*_var(--bar-offset))]"
      :class="shade && pastHero ? 'bar-veil-on' : ''"
    ></div>
    <div class="relative flex w-full justify-center">
      <div class="flex w-full items-center justify-end px-(--bar-offset)">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, provide } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useScrollStateStore } from '~/store/scrollState'
import { BAR_PAST_HERO } from '~/composables/useBar'
import { motion } from '~/motion.config'

const emit = defineEmits<{
  /** Whether the bar has left the hero; TopBar folds its controls on it. */
  pastHero: [value: boolean]
}>()

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
    /** Deepen the veil to cover an open menu. Top bars only, past the hero. */
    shade?: boolean
  }>(),
  {
    edge: 'top',
    veil: true,
    compact: false,
    shade: false,
  },
)

const { height: viewportHeight } = useWindowSize()

const { scrollY, heroHeight } = storeToRefs(useScrollStateStore())

/*
 * The hero view stays clean: no veil while the bar is over the hero, which
 * for the top bar means the page at rest. A few px of scroll and it has left
 * (`bar.scrolledAt`): the veil comes on and the bar compacts as soon as the
 * page starts moving rather than once the hero has passed under it, which
 * on a tall hero was a screen later. The bottom bar waits for the hero's
 * bottom edge to leave the viewport, which is also the moment scrolling
 * starts. A page without a hero has both on from the start.
 */
const overHero = computed(() => {
  if (heroHeight.value === 0) return false
  if (props.edge === 'top') return scrollY.value < motion.bar.scrolledAt
  return heroHeight.value - scrollY.value > viewportHeight.value - 1
})

/*
 * On a page with a hero: off until mounted, on the server and through
 * hydration alike. The layout renders the bars before the page's setup has
 * said how tall its hero is, and a server-rendered "on" would be left in
 * place by hydration (class mismatches are check-only) until the next
 * re-render. A page without a hero says so in its route meta
 * (`definePageMeta({ hero: false })`), which the server knows too, so there
 * the veil and the compact bar are in the first paint instead of fading in.
 */
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})
const route = useRoute()
const heroPage = computed(() => route.meta.hero !== false)

const pastHero = computed(
  () => !heroPage.value || (mounted.value && !overHero.value),
)
// The controls inside may care too (the heart takes its colour from it), and
// so may the parent (TopBar folds its stack into a menu button on a phone)
provide(BAR_PAST_HERO, pastHero)
watch(pastHero, (value) => emit('pastHero', value), { immediate: true })
const veilOn = computed(() => props.veil && pastHero.value)
const compactOn = computed(
  () => props.compact && props.edge === 'top' && pastHero.value,
)
</script>
