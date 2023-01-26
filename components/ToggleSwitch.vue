<!-- TODO: Here we need to implement the emit signal later -->
<template>
  <div
    class="z-10 flex h-8 w-16 cursor-pointer items-center rounded-full p-1 duration-300 ease-in-out"
    :aria-checked="checked"
    :class="checked ? colors.bgOn : colors.bgOff"
    @click="toggle"
  >
    <div
      class="fixed z-10 h-6 w-6 transform rounded-full duration-300 ease-in-out"
      :class="checked ? colors.thumbOn : colors.thumbOff, checked ? 'translate-x-8' : 'translate-x-0'"
    ></div>
    <!-- Show only when there is icons object with on and off keys -->
    <div
      class="fixed ml-8 h-6 w-6 transform transition-transform duration-300 ease-in-out"
      :class="checked ? '-translate-x-8' : 'translate-x-0'"
    >
      <component
        :is="onIcon"
        name="on"
        class="icon-animation absolute bg-transparent"
        :class="colors.iconOn, checked ? '!opacity-100' : '!opacity-0'"
      />
      <component
        :is="offIcon"
        name="off"
        class="icon-animation absolute bg-transparent"
        :class="colors.iconOff, checked ? '!opacity-0' : '!opacity-100'"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

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
    type: Object,
    required: false,
    default: {
      bgOff: 'bg-red-600',
      bgOn: 'bg-green-600',
      thumbOff: 'bg-white',
      thumbOn: 'bg-white',
      iconOn: 'fill-white',
      iconOff: 'fill-white',
    },
  },
})

const checked = ref<Boolean>(props.checked)
const colors = ref<Object>(props.colors)

function toggle() {
  checked.value = !checked.value
}
</script>

<style scoped>
.icon-animation {
  transition: opacity 0s;
  opacity: 0;
  transition-delay: 100ms;
}
</style>
