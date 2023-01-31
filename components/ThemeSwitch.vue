<template>
  <!-- Creating a toggle switch with dark / light theme -->
  <ToggleSwitch
    :onIcon="SunIcon"
    :offIcon="MoonIcon"
    :colors="{
      bgOff: 'bg-white',
      bgOn: 'bg-black',
      thumbOff: 'bg-black',
      thumbOn: 'bg-white',
      iconOff: 'fill-black',
      iconOn: 'fill-white',
    }"
    :checked="isLight"
    @update:checked="toggleTheme"
  />
</template>
<script setup lang="ts">
import SunIcon from '../assets/icons/sun.svg?component'
import MoonIcon from '../assets/icons/moon.svg?component'

const colorMode = useColorMode()
const isLight = ref<boolean>(colorMode.preference === 'light')

function toggleTheme(value: boolean) {
  colorMode.preference = value ? 'light' : 'dark'
}
</script>
