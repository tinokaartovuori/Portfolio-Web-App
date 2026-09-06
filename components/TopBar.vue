<template>
  <Bar edge="top" compact :shade="open" @past-hero="pastHero = $event">
    <div
      class="flex items-center justify-center xs:mr-2 sm:mr-4 md:mr-6 max-sm:portrait:self-start"
    >
      <Magnetic>
        <NuxtLink
          to="/"
          class="pointer-events-auto flex items-center justify-center"
        >
          <WaveText
            text="Tino Kaartovuori"
            class="text-lg font-light text-onyx sm:text-xl md:text-2xl dark:text-platinum"
            onHover
          />
        </NuxtLink>
      </Magnetic>
    </div>
    <!--
      On a portrait phone the controls stack down the right edge instead of
      squeezing into one row with the name, the switch first and the links
      last (`order`); `--top-bar-height` in index.css is the stack's height,
      so the hero and the anchors clear it. Once the bar has left the hero the
      stack folds into the menu button in its top-right corner (`folded`) and
      fans back out from it on a press; over the hero it is always open, the
      button gone. Elsewhere the button is display: none and `folded` is
      never true (the button is always rendered, so hydration agrees).
    -->
    <div
      class="relative flex w-full items-center justify-end gap-5 sm:gap-8 md:gap-10 max-sm:portrait:flex-col max-sm:portrait:items-end max-sm:portrait:gap-3"
      :class="{ 'menu-folded': folded, 'menu-open': folded && open }"
    >
      <button
        ref="menuButton"
        type="button"
        class="menu-button pointer-events-auto absolute -right-2 -top-2 hidden size-11 flex-col items-end justify-center gap-1.5 p-2 text-onyx max-sm:portrait:flex dark:text-platinum"
        :aria-expanded="open"
        :aria-label="open ? 'Close menu' : 'Menu'"
        aria-controls="top-bar-menu"
        :tabindex="folded ? undefined : -1"
        @click="open = !open"
      >
        <span
          aria-hidden="true"
          class="menu-line block h-px w-6 bg-current"
        ></span>
        <span
          aria-hidden="true"
          class="menu-line block h-px w-6 bg-current"
        ></span>
      </button>
      <!--
        The stack itself. Each item carries its index in `--i` for the fan's
        stagger; the wrapper takes the transform so the Magnetic inside can
        keep writing its own. Inert while folded shut, so nothing hidden is
        reachable by the keyboard or a screen reader.
      -->
      <div
        id="top-bar-menu"
        class="menu-stack contents"
        :inert="folded && !open"
      >
        <!--
          The site is one page: both links are anchors into it. On the home
          page the click is left to the smooth scroll's own anchor handling,
          which glides there; from a project page it is a router navigation,
          and the router scrolls to the hash once the page is in.
        -->
        <nav
          aria-label="Main"
          class="flex items-center gap-5 sm:gap-8 md:gap-10 max-sm:portrait:order-3 max-sm:portrait:flex-col max-sm:portrait:items-end max-sm:portrait:gap-3"
        >
          <div
            v-for="(item, index) in navigation"
            :key="item.hash"
            class="menu-item flex"
            :style="{ '--i': index + 2 }"
          >
            <Magnetic>
              <NuxtLink
                :to="`/${item.hash}`"
                custom
                v-slot="{ href, navigate }"
              >
                <a
                  :href="href ?? undefined"
                  class="pointer-events-auto flex items-center justify-center"
                  @click="onNavigate($event, navigate)"
                >
                  <WaveText
                    :text="item.label"
                    class="text-lg font-light text-onyx sm:text-xl md:text-2xl dark:text-platinum"
                    onHover
                  />
                </a>
              </NuxtLink>
            </Magnetic>
          </div>
        </nav>
        <!--
          In the stack every row is spaced so the visible marks, not the
          boxes, sit an equal distance apart: the heart's glyph is shorter
          than a line of text and the switch has no leading at all, so both
          carry a margin below that makes up the difference (`row-heart`,
          `row-switch`).
        -->
        <div
          class="menu-item row-heart flex max-sm:portrait:order-2"
          :style="{ '--i': 1 }"
        >
          <Magnetic>
            <LikeButton />
          </Magnetic>
        </div>
        <!--
          The switch is a fixed 64×32 px and is scaled down on narrow
          viewports. A transform leaves the layout box at full size, so the box
          is sized from the same factor: the gap to "Contact" is then the same
          gap the links have between them, at every breakpoint. In the stack
          it is drawn larger (`switch-box`), a thumb under a thumb.
        -->
        <div
          class="menu-item row-switch flex max-sm:portrait:order-1"
          :style="{ '--i': 0 }"
        >
          <Magnetic>
            <div
              class="switch-box pointer-events-auto h-[calc(2rem*var(--switch-scale))] w-[calc(4rem*var(--switch-scale))] [--switch-scale:0.5] xs:[--switch-scale:0.6] sm:[--switch-scale:0.7] md:[--switch-scale:0.8] lg:[--switch-scale:1]"
            >
              <div class="origin-top-left [scale:var(--switch-scale)]">
                <ThemeSwitch />
              </div>
            </div>
          </Magnetic>
        </div>
      </div>
    </div>
  </Bar>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useScrollStateStore } from '~/store/scrollState'

const navigation = [
  { label: 'About', hash: '#about' },
  { label: 'Contact', hash: '#contact' },
]

const route = useRoute()

// Where the controls stack (index.css keeps the same query for the height)
const portrait = useMediaQuery('(max-width: 639px) and (orientation: portrait)')
const pastHero = ref(false)
const folded = computed(() => portrait.value && pastHero.value)
const open = ref(false)
const menuButton = ref<HTMLButtonElement | null>(null)

// Back over the hero, or on a wider viewport, the stack is simply open
watch(folded, (value) => {
  if (!value) open.value = false
})
// A navigation is an answer to the menu; a hash change on the home page too
watch(
  () => route.fullPath,
  () => {
    open.value = false
  },
)
// So is scrolling on: the menu is left behind once the page has moved a
// little from where it was opened
const { scrollY } = storeToRefs(useScrollStateStore())
let openedAt = 0
watch(open, (value) => {
  if (value) openedAt = scrollY.value
})
watch(scrollY, (y) => {
  if (open.value && Math.abs(y - openedAt) > 80) open.value = false
})

const onKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || !open.value) return
  open.value = false
  menuButton.value?.focus()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

const onNavigate = (event: MouseEvent, navigate: (e?: MouseEvent) => void) => {
  open.value = false
  // Already on the page: a plain anchor click, which the scroll glides
  if (route.path === '/') return
  navigate(event)
}
</script>

<style scoped>
/*
 * The menu button lives only on a portrait phone and shows only once the bar
 * has left the hero: over the hero it is faded and shrunk away, out of reach.
 * Its two hairlines cross once the menu is open.
 */
.menu-button {
  opacity: 0;
  pointer-events: none;
  transform: scale(0.6);
  transition:
    opacity 400ms cubic-bezier(0.4, 0, 0.2, 1),
    transform 400ms cubic-bezier(0.4, 0, 0.2, 1),
    color 600ms cubic-bezier(0.4, 0, 0.2, 1);
}
.menu-folded .menu-button {
  opacity: 1;
  pointer-events: auto;
  transform: none;
}
.menu-line {
  transform-origin: center;
  transition:
    transform 400ms cubic-bezier(0.4, 0, 0.2, 1),
    background-color 600ms cubic-bezier(0.4, 0, 0.2, 1);
}
.menu-open .menu-line:first-child {
  transform: translateY(3.5px) rotate(45deg);
}
.menu-open .menu-line:last-child {
  transform: translateY(-3.5px) rotate(-45deg);
}

@media (max-width: 639px) and (orientation: portrait) {
  /* Larger than in a row: it is the first thing in the stack and a thumb
   * lands on it (48×24 px) */
  .switch-box {
    --switch-scale: 0.75;
  }
  /* Equalise the visible gaps down the stack: the row gap is 12px; a line
   * of text has ~7px of leading above its letters, the heart ~2px, the
   * switch none. Text→text reads as 26px, so the switch gives 12px and the
   * heart 4px extra to match. */
  .row-switch {
    margin-bottom: 0.75rem;
    /* A round end reads as ending before a flat one: the pill's right edge
     * sits on the same line as the letters' but looks short of it, so it is
     * carried a few px past, by about a quarter of its radius */
    margin-right: -0.1875rem;
  }
  .row-heart {
    margin-bottom: 0.25rem;
  }

  /*
   * The fan. Folded, every item is drawn up into the button's corner and
   * faded, the nearest first; opening lets them fall back into place from
   * the top down. Once folded the stack also steps down a row to leave the
   * button its corner.
   */
  .menu-item {
    transition:
      transform 500ms cubic-bezier(0.22, 1, 0.36, 1),
      opacity 350ms cubic-bezier(0.4, 0, 0.2, 1),
      visibility 0s linear 0s;
    transition-delay: calc((3 - var(--i)) * 45ms);
  }
  .menu-folded .menu-item {
    /* The whole stack sits under the button: 49px, so that the open button's
     * cross (drawn ~17px tall, ending 39px down) is the same 26px visible
     * gap from the switch under it as the switch is from the heart */
    --menu-drop: 3.0625rem;
    transform: translateY(var(--menu-drop));
    transition-delay: calc(var(--i) * 45ms);
  }
  .menu-folded:not(.menu-open) .menu-item {
    opacity: 0;
    visibility: hidden;
    /* Drawn up into the button: each row by its own distance from it, the
     * lower rows further, and turned a little about the corner */
    transform: translateY(calc(var(--menu-drop) - (var(--i) + 1) * 2.25rem))
      translateX(0.5rem) rotate(calc(-4deg * (var(--i) + 1))) scale(0.8);
    transform-origin: top right;
    /* Visibility flips only once the last row has faded, so nothing is cut
     * off mid-fade; the stagger runs from the bottom row up */
    --d: calc((3 - var(--i)) * 35ms);
    transition:
      transform 400ms cubic-bezier(0.4, 0, 0.2, 1) var(--d),
      opacity 250ms cubic-bezier(0.4, 0, 0.2, 1) var(--d),
      visibility 0s linear calc(var(--d) + 400ms);
  }
  .menu-folded.menu-open .menu-item {
    transform-origin: top right;
  }
}

@media (prefers-reduced-motion: reduce) {
  .menu-button,
  .menu-line,
  .menu-item,
  .menu-folded:not(.menu-open) .menu-item {
    transition-duration: 1ms;
    transition-delay: 0s;
  }
}
</style>
