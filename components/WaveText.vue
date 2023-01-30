<template>
  <span
    class="whitespace-nowrap"
    @mouseenter="mouseIn = true"
    @mouseleave="mouseIn = false"
  >
    <div
      v-for="(letter, index) in props.text"
      ref="textDivs"
      :key="letter"
      class="relative inline-block text-xl md:text-2xl"
    >
      {{ letter != ' ' ? letter : '&nbsp;' }}
    </div>
  </span>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import gsap from 'gsap'

const props = defineProps({
  text: {
    type: String,
    required: true,
  },
  onHover: {
    type: Boolean,
    required: false,
    default: false,
  },
})

const mouseIn = ref<Boolean>(false)
let animationPlaying = false

const textDivs = ref<HTMLElement[]>([])

const timeline = gsap.timeline({
  paused: true,
  repeatDelay: 1,
  onComplete: () => {
    if (!props.onHover) return // if onHover is false
    if (mouseIn.value) {
      timeline.play(0)
      animationPlaying = true
      return // Animation continued
    }
    // Animation stopped
    timeline.pause()
    animationPlaying = false
  },
})

onMounted(() => {
  // Put every div in a timeline with 100ms delay from each
  textDivs.value.forEach((div, index) => {
    // Creating an animation to timeline where opacity is pulsing from 1 to 0.5 and back up
    // Each div has 100ms delay from each other
    timeline.to(
      div,
      {
        opacity: 0.4,
        duration: 0.5,
        ease: 'power1.inOut',
      },
      index * 0.1,
    )
    timeline.to(
      div,
      {
        opacity: 1,
        duration: 0.5,
        ease: 'power1.inOut',
      },
      index * 0.1 + 0.5,
    )
  })

  // If onHover is false, repeat the animation forever
  if (!props.onHover) {
    timeline.repeat(-1)
    timeline.play(0)
    animationPlaying = true
  }
})

watch(
  () => mouseIn.value,
  (value) => {
    if (!value) return
    if (!props.onHover) return
    if (animationPlaying) return
    // Start playing animation on hover
    timeline.play(0)
    animationPlaying = true
  },
)
</script>
