<template>
  <div
    class="flex h-full w-full flex-col items-center justify-center bg-platinum px-[12%] text-center dark:bg-onyx"
  >
    <p
      class="text-7xl font-extralight text-onyx dark:text-platinum sm:text-8xl md:text-9xl"
    >
      {{ error.statusCode }}
    </p>
    <h1
      class="mt-6 text-lg font-light text-onyx dark:text-platinum sm:text-xl md:text-2xl"
    >
      {{ message }}
    </h1>
    <button
      class="mt-12 border-b-2 border-pink-500 pb-1 text-sm font-light text-onyx dark:text-platinum sm:text-base md:text-lg"
      @click="handleError"
    >
      Back to the start
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const message = computed(() =>
  props.error.statusCode === 404
    ? 'This page does not exist.'
    : 'Something went wrong.',
)

useHead({
  title: computed(() =>
    props.error.statusCode === 404 ? 'Page not found' : 'Error',
  ),
})

function handleError() {
  clearError({ redirect: '/' })
}
</script>
