<template>
  <!-- The dark / light switch. Its look is CSS from the theme class; see ToggleSwitch. -->
  <ToggleSwitch
    :onIcon="SunIcon"
    :offIcon="MoonIcon"
    :checked="isLight"
    label="Light mode"
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
