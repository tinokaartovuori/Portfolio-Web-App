<template>
  <!-- Wrap one interactive element; it is pulled toward a nearby pointer -->
  <span ref="root" class="inline-block will-change-transform">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useMagnetic } from '~/composables/useMagnetic'

const props = defineProps<{
  radius?: number
  strength?: number
}>()

const root = ref<HTMLElement | null>(null)
useMagnetic(root, { radius: props.radius, strength: props.strength })
</script>
