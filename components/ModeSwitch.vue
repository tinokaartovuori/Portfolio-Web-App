<template>
  <!-- Creating a toggle switch with dark / light theme -->
  <ToggleSwitch
    :onIcon="SunIcon"
    :offIcon="MoonIcon"
    :colors="{
      bgOff: 'bg-black',
      bgOn: 'bg-white',
      thumbOff: 'bg-white',
      thumbOn: 'bg-black',
      iconOff: 'fill-white',
      iconOn: 'fill-black',
    }"
  />
</template>

<script setup lang="ts">
import SunIcon from '../assets/icons/sun.svg?component'
import MoonIcon from '../assets/icons/moon.svg?component'
</script>
