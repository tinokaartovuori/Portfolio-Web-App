<template>
  <main class="h-full w-full" @touchstart="touchstart" @touchmove="touchmove">
    <div id="app-wrapper" class="relative h-full">
      <header>
        <TopBar class="z-50" />
      </header>
      <ClientOnly>
        <ThreeScrollCanvas />
      </ClientOnly>
      <!-- TODO: <Preloader /> -->
      <slot />
      <!-- BottomBar will be replaced with different component later and moved to child elements -->
      <BottomBar class="z-50" />
      <ScrollTrack />
    </div>
  </main>
</template>

<script setup lang="ts">
// These are added to prevent pinch zooming on mobile
function touchstart(e: TouchEvent) {
  if (e.touches.length > 1) {
    e.preventDefault()
  }
}
function touchmove(e: TouchEvent) {
  if (e.touches.length > 1) {
    e.preventDefault()
  }
}
</script>
