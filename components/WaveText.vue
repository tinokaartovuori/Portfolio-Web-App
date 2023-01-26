<!-- FIXME: Here we have a bug when the page is going idle in the background tab the animation is messed up -->
<!-- TODO: We may want to reimplement this -->
<template>
  <span
    class="flex w-full"
    ref="waveSpan"
    @mouseover="linkHover = true"
    @mouseleave="linkHover = false"
  >
    <div
      v-for="(letter, index) in props.text"
      :key="letter"
      class="relative inline-block text-xl md:text-2xl"
      :style="{ opacity: opacityArray[index] || 1, color: props.color }"
    >
      {{ letter != ' ' ? letter : '&nbsp;' }}
    </div>
  </span>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps({
  text: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    required: false,
    default: 'white',
  },
  repeat: {
    type: Boolean,
    required: false,
    default: false,
  },
})

// Create a ref for waveEffect
const text = ref<string>('')
const linkHover = ref<boolean>(false)
const animationRunning = ref<boolean>(false)
// Create a ref for opacityArray that contains numbers
const opacityArray = ref<number[]>([])

// Create a ref for wave-span
// waveSpan can be a element or null
const waveSpan = ref<HTMLElement | null>(null)
// Get the children of wave-span
const textDivs = ref<HTMLCollection | []>([])
// Get the children of waveSpan in TypeScript and add them to textDivs
textDivs.value = waveSpan.value?.children || []
// create an array with values of 1
opacityArray.value = Array(textDivs.value.length).fill(1)

// Link is hovered trigger the animation start
watch(linkHover, () => {
  if (linkHover.value === true) {
    animationRunning.value = true
  }
})

// When animationRunning is changed to true, start the animation
watch(animationRunning, () => {
  if (animationRunning.value === false) return
  startAnimation(0)
})

// This is called for each letter recursively and waits 52ms between each letter
// to make a wave like effect
function startAnimation(index: number) {
  // Between each letter wait 52ms
  setTimeout(() => {
    playLetterAnimation(index) // Play animation for the letter
    if (index >= textDivs.value.length) {
      // If the link is not hovered anymore, stop the animation
      if (linkHover.value === false && props.repeat === false) {
        animationRunning.value = false
        return
      }
      // If the link is hovered, wait a little bit and start the animation again
      setTimeout(() => {
        // After a wait check again if the link is still hovered
        if (linkHover.value === true || props.repeat === true) {
          return startAnimation(0)
        }
        animationRunning.value = false
        return
      }, 1500 - 52 * textDivs.value.length)
      return
    }
    // Start animation for the next letter
    return startAnimation(index + 1)
  }, 52)
}

// This is called for each letter and makes the opacity go up and down
function playLetterAnimation(index: number) {
  let ready = false
  let directionDown = true
  opacityAnimation()

  function opacityAnimation() {
    setTimeout(() => {
      if (directionDown === true) {
        opacityArray.value[index] -= 0.01
        if (opacityArray.value[index] <= 0.5) {
          directionDown = false
        }
      } else {
        opacityArray.value[index] += 0.01
        if (opacityArray.value[index] >= 1) {
          ready = true
        }
      }
      if (ready) {
        opacityArray.value[index] = 1
        return
      }
      return opacityAnimation()
    }, 1)
  }
}

onMounted(() => {
  // Get the children of waveSpan in TypeScript and add them to textDivs
  textDivs.value = waveSpan.value?.children || []
  // create an array with values of 1
  opacityArray.value = Array(textDivs.value.length).fill(1)

  if (props.repeat === true) {
    animationRunning.value = true
    linkHover.value = true
    animationRunning.value = true
  }
})
</script>
