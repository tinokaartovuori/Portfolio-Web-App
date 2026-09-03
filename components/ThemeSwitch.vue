<template>
  <!-- Creating a toggle switch with dark / light theme -->
  <ToggleSwitch
    :onIcon="SunIcon"
    :offIcon="MoonIcon"
    :colors="{
      bgOff: '#dde0ed',
      bgOn: '#0C0D12',
      thumbOff: '#0C0D12',
      thumbOn: '#dde0ed',
      iconOff: '#0C0D12',
      iconOn: '#dde0ed',
    }"
    :checked="isLight"
    label="Light mode"
    fadeIn
    @update:checked="toggleTheme"
  />
</template>
<script setup lang="ts">
import SunIcon from '../assets/icons/sun.svg?component'
import MoonIcon from '../assets/icons/moon.svg?component'

const colorModeInstance = useColorMode()

// `preference` can be 'system', so the resolved `value` is what the switch shows
const isLight = computed(() => colorModeInstance.value === 'light')

function toggleTheme(value: boolean) {
  colorModeInstance.preference = value ? 'light' : 'dark'
}
</script>
