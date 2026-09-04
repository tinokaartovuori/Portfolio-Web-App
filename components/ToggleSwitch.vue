<template>
  <button
    ref="backgroundElement"
    type="button"
    role="switch"
    class="relative z-10 flex h-8 w-16 cursor-pointer appearance-none items-center rounded-full p-1 transition-none"
    :aria-checked="checked"
    :aria-label="label"
    @click="toggle"
  >
    <div
      ref="handleElement"
      class="absolute z-10 h-6 w-6 transform rounded-full transition-none"
    ></div>
    <div
      ref="iconElement"
      class="absolute h-6 w-6 transition-none duration-[0]"
    >
      <div
        v-if="onIcon"
        ref="onIconElement"
        class="absolute bg-transparent transition-none duration-[0]"
        :style="`fill: ${colors.iconOn}; opacity: 0;`"
      >
        <component :is="onIcon" aria-hidden="true" />
      </div>
      <div
        v-if="offIcon"
        ref="offIconElement"
        class="absolute bg-transparent transition-none duration-[0]"
        :style="`fill: ${colors.iconOff}; opacity: 0;`"
      >
        <component :is="offIcon" aria-hidden="true" />
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { PropType } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import { gsap } from 'gsap'

// Make an interface for Colors object
interface Colors {
  bgOff: string
  bgOn: string
  thumbOff: string
  thumbOn: string
  iconOn: string
  iconOff: string
}

const props = defineProps({
  checked: {
    type: Boolean,
    required: false,
    default: false,
  },
  onIcon: {
    type: Object,
    required: false,
  },
  offIcon: {
    type: Object,
    required: false,
  },
  colors: {
    // Object containing {key, tailwind -class}
    type: Object as PropType<Colors>,
    required: false,
    // A factory, or every instance would share the one default object
    default: () => ({
      bgOff: '#DC2626',
      bgOn: '#059669',
      thumbOff: '#dde0ed',
      thumbOn: '#dde0ed',
      iconOn: '#dde0ed',
      iconOff: '#dde0ed',
    }),
  },
  fadeIn: {
    type: Boolean,
    required: false,
    default: false,
  },
  label: {
    // Accessible name for the switch, since it only renders icons
    type: String,
    required: false,
    default: 'Toggle',
  },
})

const backgroundElement = ref<HTMLButtonElement | null>(null)
const handleElement = ref<HTMLElement | null>(null)
const iconElement = ref<HTMLElement | null>(null)
const onIconElement = ref<HTMLElement | null>(null)
const offIconElement = ref<HTMLElement | null>(null)

const emits = defineEmits(['update:checked'])
const colors = ref<Colors>(props.colors)
const checked = ref<boolean>(props.checked)

const reducedMotion = usePreferredReducedMotion()
const prefersReducedMotion = computed(() => reducedMotion.value === 'reduce')

// The switch still has to arrive in its new state; only the travel is dropped.
const motionDuration = (seconds: number) =>
  prefersReducedMotion.value ? 0 : seconds

// Built on mount rather than in setup: creating a timeline wakes gsap's ticker,
// which during SSR would spin a timer in the render process for no reason.
let timeline: ReturnType<typeof gsap.timeline> | null = null

function toggle() {
  checked.value = !checked.value
  if (checked.value) {
    useOn(motionDuration(0.5))
  } else {
    useOff(motionDuration(0.5))
  }
  emits('update:checked', checked.value)
}

function useOn(duration: number) {
  if (!timeline) return
  timeline.clear()
  timeline.to(
    backgroundElement.value,
    {
      duration: duration,
      backgroundColor: colors.value.bgOn,
      opacity: 1,
      ease: 'power1.inOut',
    },
    0,
  )
  timeline.to(
    handleElement.value,
    {
      duration: duration,
      x: 32,
      backgroundColor: colors.value.thumbOn,
      ease: 'power1.inOut',
    },
    0,
  )
  timeline.to(
    iconElement.value,
    {
      duration: duration,
      x: 0,
      ease: 'power1.inOut',
    },
    0,
  )
  if (onIconElement.value) {
    timeline.to(
      onIconElement.value,
      {
        duration: duration,
        opacity: 1,
        ease: 'power1.inOut',
      },
      0,
    )
  }
  if (offIconElement.value) {
    timeline.to(
      offIconElement.value,
      {
        duration: duration / 2,
        opacity: 0,
        ease: 'power1.inOut',
      },
      0,
    )
  }
  timeline.play(0)
}

function useOff(duration: number) {
  if (!timeline) return
  timeline.clear()
  timeline.to(
    backgroundElement.value,
    {
      duration: duration,
      backgroundColor: colors.value.bgOff,
      opacity: 1,
      ease: 'power1.inOut',
    },
    0,
  )
  timeline.to(
    handleElement.value,
    {
      duration: duration,
      x: 0,
      backgroundColor: colors.value.thumbOff,
      ease: 'power1.inOut',
    },
    0,
  )
  timeline.to(
    iconElement.value,
    {
      duration: duration,
      x: 32,
      fill: colors.value.iconOff,
      ease: 'power1.inOut',
    },
    0,
  )
  if (onIconElement.value) {
    timeline.to(
      onIconElement.value,
      {
        duration: duration / 2,
        opacity: 0,
        ease: 'power1.inOut',
      },
      0,
    )
  }
  if (offIconElement.value) {
    timeline.to(
      offIconElement.value,
      {
        duration: duration,
        opacity: 1,
        ease: 'power1.inOut',
      },
      0,
    )
  }
  timeline.play(0)
}

function startFadeIn() {
  if (!timeline) return
  timeline.clear()
  timeline.to(backgroundElement.value, {
    duration: 0,
    opacity: 0,
    ease: 'power1.inOut',
  })
  timeline.to(backgroundElement.value, {
    duration: motionDuration(0.8),
    opacity: 1,
    ease: 'power1.inOut',
  })
  timeline.play(0)
}

// The parent owns the truth (here: the resolved color mode), so follow it when it
// changes from anywhere other than this switch — e.g. the OS theme flipping.
watch(
  () => props.checked,
  (value) => {
    if (value === checked.value) return
    checked.value = value
    value ? useOn(motionDuration(0.5)) : useOff(motionDuration(0.5))
  },
)

onMounted(() => {
  timeline = gsap.timeline()
  checked.value = props.checked
  if (checked.value) {
    useOn(0)
  } else {
    useOff(0)
  }
  if (!props.fadeIn) return
  startFadeIn()
})

onUnmounted(() => {
  // gsap's root timeline holds on to this otherwise
  timeline?.kill()
  timeline = null
})
</script>
