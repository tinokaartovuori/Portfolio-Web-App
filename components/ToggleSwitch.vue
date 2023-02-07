<template>
  <div
    ref="backgroundElement"
    class="z-10 flex h-8 w-16 cursor-pointer items-center rounded-full p-1 transition-none"
    :aria-checked="checked"
    @click="toggle"
  >
    <div
      ref="handleElement"
      class="absolute z-10 h-6 w-6 transform rounded-full transition-none"
    ></div>
    <div ref="iconElement" class="fixed h-6 w-6 transition-none duration-[0]">
      <div
        v-if="onIcon"
        ref="onIconElement"
        class="absolute bg-transparent transition-none duration-[0]"
        :style="`fill: ${colors.iconOn}; opacity: 0;`"
      >
        <component :is="onIcon" name="on" />
      </div>
      <div
        v-if="offIcon"
        ref="offIconElement"
        class="absolute bg-transparent transition-none duration-[0]"
        :style="`fill: ${colors.iconOff}; opacity: 0;`"
      >
        <component :is="offIcon" name="off" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PropType, ref } from 'vue'
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
    default: {
      bgOff: '#DC2626',
      bgOn: '#059669',
      thumbOff: '#dde0ed',
      thumbOn: '#dde0ed',
      iconOn: '#dde0ed',
      iconOff: '#dde0ed',
    },
  },
  fadeIn: {
    type: Boolean,
    required: false,
    default: false,
  },
})

const backgroundElement = ref<HTMLElement | null>(null)
const handleElement = ref<HTMLElement | null>(null)
const iconElement = ref<HTMLElement | null>(null)
const onIconElement = ref<HTMLElement | null>(null)
const offIconElement = ref<HTMLElement | null>(null)

const emits = defineEmits(['update:checked'])
const colors = ref<Colors>(props.colors)
const checked = ref<Boolean>(props.checked)

const timeline = gsap.timeline()

function toggle() {
  checked.value = !checked.value
  if (checked.value) {
    useOn(0.5)
  } else {
    useOff(0.5)
  }
  emits('update:checked', checked.value)
}

function useOn(duration: number) {
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
  timeline.clear()
  timeline.to(backgroundElement.value, {
    duration: 0,
    opacity: 0,
    ease: 'power1.inOut',
  })
  timeline.to(backgroundElement.value, {
    duration: 0.8,
    opacity: 1,
    ease: 'power1.inOut',
  })
  timeline.play(0)
}

onMounted(() => {
  checked.value = props.checked
  if (checked.value) {
    useOn(0)
  } else {
    useOff(0)
  }
  if (!props.fadeIn) return
  startFadeIn()
})
</script>
