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
    fadeIn
    @update:checked="toggleTheme"
  />
</template>
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAppStateStore } from '~/store/appState'
import SunIcon from '../assets/icons/sun.svg?component'
import MoonIcon from '../assets/icons/moon.svg?component'

const appStateStore = useAppStateStore()
const { colorMode } = storeToRefs(appStateStore)

const colorModeInstance = useColorMode()
colorMode.value = colorModeInstance.preference as 'light' | 'dark'
const isLight = ref<boolean>(colorModeInstance.preference === 'light')

function toggleTheme(value: boolean) {
  colorModeInstance.preference = value ? 'light' : 'dark'
  colorMode.value = value ? 'light' : 'dark'
}
</script>
