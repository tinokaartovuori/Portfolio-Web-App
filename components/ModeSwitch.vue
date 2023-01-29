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
  />
</template>

<script setup lang="ts">
import SunIcon from '../assets/icons/sun.svg?component'
import MoonIcon from '../assets/icons/moon.svg?component'
</script>
