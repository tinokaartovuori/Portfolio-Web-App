<template>
  <!--
    Sized to the largest viewport (100lvh), not the window: on a phone the
    address bar comes and goes with the scroll and the window height with
    it; a canvas that followed was stretched until the debounced resize
    caught up and every mesh was measured against a stale height, a jolt
    through the scene on every toggle of the bar. The extra rows sit under
    the bar when it is shown. Viewport.ts carries this box's size to the
    meshes.
  -->
  <div
    ref="host"
    class="gl-host fixed inset-x-0 top-0 z-0 bg-platinum dark:bg-onyx"
  >
    <canvas ref="threeCanvas" class="absolute inset-0" aria-hidden="true" />
  </div>
</template>

<script setup lang="ts">
import Scenario from './three-components/Scenario'
import ImageManager from './three-components/ImageManager'
import ElementManager from './three-components/ElementManager'
import Particles from './three-components/Particles'
import HalationPass from './three-components/HalationPass'
import {
  setTextureAnisotropy,
  sweepTextures,
  disposeAllTextures,
} from './three-components/TextureCache'
import { ScrollFeel } from '~/utils/scrollFeel'
import { Color } from 'three'
import type { FrameContext } from './three-components/FrameContext'

import type { Ref } from 'vue'
import { storeToRefs } from 'pinia'

import { useThreeObjectStateStore } from '~/store/threeObjectState'
import { useScrollStateStore } from '~/store/scrollState'
import { useElementSize } from '@vueuse/core'
import { viewport } from '~/components/three-components/Viewport'
import { onFrame, damp } from '~/composables/useFrameLoop'
import { scrollFrame } from '~/composables/useSmoothScroll'
import { pointerFrame, createPointerTracker } from '~/composables/usePointer'
import { revealFrame, startSceneReveal } from '~/composables/useReveal'
import { motion } from '~/motion.config'

// Trailing debounce for window resizes, so a drag only rebuilds once it settles
const resizeDebounce = 100

/*
 * Screen-space passes go through an EffectComposer, which costs a full-screen
 * render target per frame. The halation is the one pass so far; anything
 * else (blur, glass) joins it in the array handed to `enablePostProcessing`,
 * before it, since it is the one that encodes for the screen.
 */
const POST_PROCESSING = true

/*
 * The halation's own reading of the scroll: the same ScrollFeel the images
 * use, so its "fast" is their "fast", eased and damped into a strength the
 * pass draws with. The tint follows the theme like every palette colour.
 */
const halationFeel = new ScrollFeel(motion.scrollFeel)
const accentLight = new Color(motion.palette.accent[0])
const accentDark = new Color(motion.palette.accent[1])
let halationAmount = 0

const threeObjectState = useThreeObjectStateStore()
const { threeElementTracker, threeImageTracker } = storeToRefs(threeObjectState)

const host: Ref<HTMLElement | null> = ref(null)
// The host's own size (a ResizeObserver), which on a phone does not follow
// the address bar the way the window's does; see the template
const { width, height } = useElementSize(host)
const threeCanvas: Ref<HTMLCanvasElement | null> = ref(null)

/** Publishes the host's size to the meshes (Viewport.ts) */
const publishViewport = () => {
  // The element's own numbers first: the observer's refs are 0 until its
  // first callback, a frame after mount
  viewport.width = host.value?.clientWidth || width.value || window.innerWidth
  viewport.height =
    host.value?.clientHeight || height.value || window.innerHeight
}

// The resolved theme ('light' | 'dark'); this component is client-only, so
// it is known by the time anything here runs
const colorMode = useColorMode()
const themeTarget = () => (colorMode.value === 'dark' ? 1 : 0)

// Scenario: a scene, a camera and a renderer
let scenario: Scenario | null = null
let imageManager: ImageManager | null = null
let elementManager: ElementManager | null = null
// The dust behind the page: the one thing in the scene not pinned to an element
let particles: Particles | null = null
const { heroHeight } = storeToRefs(useScrollStateStore())

let resizeTimeout: ReturnType<typeof setTimeout> | null = null
let rebuildQueued = false
let sweepQueued = false
let torndown = false
const stopFrame: Array<() => void> = []
let stopPointer: (() => void) | null = null
let stopContextLost: (() => void) | null = null
let halation: HalationPass | null = null

// One context object, reused every frame, so the update path allocates nothing
const frame: FrameContext = {
  dt: 0,
  time: 0,
  scroll: scrollFrame,
  pointer: pointerFrame,
  reduced: false,
  theme: 0,
  heroHeight: Number.POSITIVE_INFINITY,
  rendered: false,
  reveal: 0,
}

/**
 * Puts the page back the way it was before the scene took over from it: the
 * `<img>`s visible, the CSS plates visible. For an unmount and for a lost
 * context, where the canvas may stay blank.
 */
function restoreDom() {
  imageManager?.restoreDom()
  for (const plate of document.querySelectorAll<HTMLElement>('[data-plate]'))
    plate.style.visibility = ''
}

/**
 * The scene's reveal starts the frame after the first render, once the hero
 * has been measured (`heroHeight` finite; 0 is a page without one), so the
 * dust's cut at the hero's edge is in place before the dust comes up.
 */
function maybeStartSceneReveal() {
  if (frame.rendered && Number.isFinite(heroHeight.value)) startSceneReveal()
}
watch(heroHeight, maybeStartSceneReveal)

onMounted(async () => {
  const canvas = threeCanvas.value
  if (!canvas) return

  // Start on the current theme rather than fading in from the wrong one
  frame.theme = themeTarget()

  // No WebGL (or a blocked context): the page stays what it is — the CSS
  // plates and the `<img>`s are the design without the layer over them
  try {
    publishViewport()
    scenario = new Scenario(canvas)
  } catch (error) {
    if (import.meta.dev) console.warn('[ThreeScrollCanvas] no WebGL', error)
    scenario = null
    return
  }
  // Not on a touch device: the composer's multisampled half-float target
  // and the halation's own render and blur are a full-screen cost per
  // frame that a phone's GPU pays in dropped frames, for an effect that is
  // slight at that size. Drawing goes straight to the canvas there.
  const coarse = window.matchMedia('(pointer: coarse)').matches
  if (POST_PROCESSING && !coarse) {
    halation = new HalationPass(scenario.scene, scenario.camera)
    // The halation pass encodes for the screen itself (see its header), so
    // it is the last pass and there is no OutputPass
    scenario.enablePostProcessing([halation])
  }
  setTextureAnisotropy(scenario.renderer.capabilities.getMaxAnisotropy())
  imageManager = new ImageManager(scenario.scene, scenario.renderer)
  elementManager = new ElementManager(scenario.scene)
  particles = new Particles(scenario.scene)
  stopPointer = createPointerTracker()

  imageManager.loadImages(threeImageTracker.value)
  elementManager.loadElements(threeElementTracker.value)

  // A lost context leaves the canvas blank: give the page its DOM back
  const onContextLost = (event: Event) => {
    event.preventDefault()
    restoreDom()
  }
  canvas.addEventListener('webglcontextlost', onContextLost)
  stopContextLost = () =>
    canvas.removeEventListener('webglcontextlost', onContextLost)

  /*
   * Both stages run every frame, in this order, from the one shared clock.
   * They used to be a Vue watcher on scrollY and a private requestAnimationFrame
   * respectively — so mesh state only advanced when the scroll value changed
   * (freezing the deformation mid-decay the moment scrolling stopped) and the
   * draw could happen before or after the transform depending on mount order.
   *
   * The transform stage may start at once: nothing in it touches the DOM
   * until `frame.rendered`. The render stage waits for the shaders to
   * compile, so the first drawn frame is not also the frame that stalls on
   * compiling them; the page holds the screen meanwhile.
   */
  stopFrame.push(
    onFrame('transform', (dt, time) => {
      if (!imageManager || !elementManager) return
      frame.dt = dt
      frame.time = time
      frame.reduced = scrollFrame.reduced
      // Blend toward the theme over the same ~600ms the CSS colours take;
      // under reduced motion the CSS transition is 1ms, so snap to match
      const theme = themeTarget()
      frame.theme = frame.reduced
        ? theme
        : damp(frame.theme, theme, motion.theme.smoothing, dt)
      frame.heroHeight = heroHeight.value
      frame.reveal = revealFrame.scene
      imageManager.updateImages(frame)
      elementManager.updateElementPositions(frame)
      particles?.update(frame)
      if (halation) updateHalation(halation, dt)
      if (sweepQueued) {
        sweepQueued = false
        sweepTextures()
      }
    }),
  )

  try {
    await scenario.renderer.compileAsync(scenario.scene, scenario.camera)
  } catch {
    // Compiled on the first draw instead
  }
  if (torndown || !scenario) return

  stopFrame.push(
    onFrame('render', () => {
      if (!scenario) return
      scenario.render()
      if (!frame.rendered) {
        frame.rendered = true
        maybeStartSceneReveal()
      }
    }),
  )
})

onUnmounted(() => {
  torndown = true

  for (const stop of stopFrame) stop()
  stopFrame.length = 0
  stopPointer?.()
  stopPointer = null
  stopContextLost?.()
  stopContextLost = null
  halation?.dispose()
  halation = null

  if (resizeTimeout !== null) {
    clearTimeout(resizeTimeout)
    resizeTimeout = null
  }

  restoreDom()
  imageManager?.removeImages()
  elementManager?.removeElements()
  particles?.dispose()
  scenario?.dispose()
  disposeAllTextures()

  imageManager = null
  elementManager = null
  particles = null
  scenario = null
})

// The renderer has to follow both dimensions: a resize that keeps the aspect
// ratio would otherwise leave every mesh measured against a stale viewport
watch([width, height], () => {
  if (resizeTimeout !== null) clearTimeout(resizeTimeout)

  resizeTimeout = setTimeout(() => {
    resizeTimeout = null
    resize()
  }, resizeDebounce)
})

/*
 * A rebuild drops every mesh, so it must happen once per burst rather than
 * once per registration: trackers mount one after the other (and
 * asynchronously, once content arrives from a content layer), and each of
 * those lands as its own change on the registry. The textures survive it —
 * they are refcounted in TextureCache and swept a frame later, by which time
 * the new meshes hold them again.
 */
watch(threeObjectState, () => {
  if (rebuildQueued) return
  rebuildQueued = true

  nextTick(() => {
    rebuildQueued = false
    // nextTick callbacks cannot be cancelled, so a teardown between the
    // schedule and the flush has to be checked for here
    if (torndown) return
    if (!imageManager || !elementManager) return

    imageManager.removeImages()
    elementManager.removeElements()
    imageManager.loadImages(threeImageTracker.value)
    elementManager.loadElements(threeElementTracker.value)
    sweepQueued = true
  })
})

/**
 * Strength from the scroll: nothing extra at a gentle glide, ramping up
 * between the two thresholds, eased and damped so it swells and fades as one
 * motion. Under reduced motion only the resting amount remains.
 */
function updateHalation(pass: HalationPass, dt: number) {
  const cfg = motion.halation
  halationFeel.update(scrollFrame.velocity, dt)
  const speed = Math.abs(halationFeel.drive)
  const ramp = Math.min(
    1,
    Math.max(0, (speed - cfg.start) / (cfg.full - cfg.start)),
  )
  const target = frame.reduced ? 0 : ramp * ramp * (3 - 2 * ramp)
  halationAmount = damp(halationAmount, target, cfg.smoothing, dt)
  pass.strength = cfg.rest + cfg.scroll * halationAmount
  pass.tint.copy(accentLight).lerp(accentDark, frame.theme)
}

const resize = () => {
  if (!scenario || !imageManager || !elementManager) return

  publishViewport()
  imageManager.resizeImages()
  elementManager.updateElements()
  particles?.resize()

  scenario.updateCameraSize(viewport.width, viewport.height)
  scenario.updateRendererSize(viewport.width, viewport.height)
}
</script>

<style scoped>
/* The largest viewport where the unit exists (every current browser), the
   window height where it does not */
.gl-host {
  height: 100vh;
  height: 100lvh;
}
</style>
