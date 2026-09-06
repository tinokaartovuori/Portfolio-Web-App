<template>
  <!--
    A real, visible `<img>` — the photograph loads like on any page, in the
    smallest format and size the browser will take — that the WebGL layer
    measures, textures itself from, and then fades out from over its own
    mesh (see WavyImage). `<picture>` is `display: contents`, so the img is
    what the parent lays out and the attributes fall through to it. The
    `background` variant stays invisible: its treatment (greyscale, faded,
    dissolved) has no DOM equivalent, so it fades in from nothing instead.
  -->
  <picture v-if="meta" class="contents">
    <source type="image/avif" :srcset="srcsetFor(imageUrl, 'avif')" :sizes />
    <source type="image/webp" :srcset="srcsetFor(imageUrl, 'webp')" :sizes />
    <img
      ref="threeImg"
      v-bind="$attrs"
      :src="largestFor(imageUrl, 'jpg')"
      :srcset="srcsetFor(imageUrl, 'jpg')"
      :sizes
      :width="meta.width"
      :height="meta.height"
      :alt
      :data-variant="variant"
      :loading="priority ? 'eager' : 'lazy'"
      :fetchpriority="priority ? 'high' : undefined"
      class="block h-auto w-full object-cover"
      :class="{ 'opacity-0': hidden }"
      crossorigin="anonymous"
      decoding="async"
    />
  </picture>
  <img
    v-else
    ref="threeImg"
    v-bind="$attrs"
    :src="imageUrl"
    :alt
    :data-variant="variant"
    :loading="priority ? 'eager' : 'lazy'"
    :fetchpriority="priority ? 'high' : undefined"
    class="block h-auto w-full object-cover"
    :class="{ 'opacity-0': hidden }"
    crossorigin="anonymous"
    decoding="async"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { PropType } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { useThreeObjectStateStore } from '~/store/threeObjectState'
import { motion } from '~/motion.config'
import { imageMeta, srcsetFor, largestFor } from '~/utils/images'

defineOptions({ inheritAttrs: false })

const threeObjectStateStore = useThreeObjectStateStore()

const props = defineProps({
  imageUrl: {
    type: String,
    required: true,
  },
  threeReference: {
    type: String,
    required: true,
  },
  alt: {
    type: String,
    default: '',
  },
  /**
   * A named treatment from `motion.image.variants` (`background` for an
   * image that sits behind the page). The WebGL layer reads it off the
   * element, the same way it reads the box.
   */
  variant: {
    type: String as PropType<keyof typeof motion.image.variants>,
    default: undefined,
  },
  /** The `sizes` attribute: how wide the box is per viewport, for srcset. */
  sizes: {
    type: String,
    default: '100vw',
  },
  /**
   * An image in the first viewport: fetched eagerly and first, and preloaded
   * from the head. Everything else is lazy.
   */
  priority: {
    type: Boolean,
    default: false,
  },
})

const meta = computed(() => imageMeta(props.imageUrl))
// Only the background treatment has no DOM version to show meanwhile
const hidden = computed(() => props.variant === 'background')

if (props.priority && meta.value) {
  useHead({
    link: [
      {
        rel: 'preload',
        as: 'image',
        type: 'image/avif',
        imagesrcset: srcsetFor(props.imageUrl, 'avif'),
        imagesizes: props.sizes,
      },
    ],
  })
}

const threeImg = ref<HTMLImageElement | null>(null)
// The node we registered, so unmount can only ever drop our own entry
let registered: HTMLImageElement | null = null

/*
 * Only an image that is laid out gets a mesh. One that CSS has hidden at
 * this breakpoint (`display: none`, so no client rects) registers nothing —
 * a page can render the same photograph twice, one box per layout, and only
 * the box the viewport shows reaches the scene. Re-checked on every window
 * resize, since a breakpoint crossing swaps which one that is.
 */
const { width } = useWindowSize()
const sync = () => {
  const img = threeImg.value
  if (!img || !props.threeReference || !props.imageUrl) return
  const shown = img.getClientRects().length > 0
  if (shown && !registered) {
    threeObjectStateStore.addThreeImage(props.threeReference, img)
    registered = img
  } else if (!shown && registered) {
    threeObjectStateStore.remove(props.threeReference, registered)
    registered = null
  }
}

onMounted(sync)
watch(width, sync)

onUnmounted(() => {
  // The registry is global, so a detached image has to drop out of it again
  if (!registered) return
  threeObjectStateStore.remove(props.threeReference, registered)
  registered = null
})
</script>
