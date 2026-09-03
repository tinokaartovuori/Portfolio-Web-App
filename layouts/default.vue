<template>
  <main class="h-full w-full">
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
