<template>
  <div id="app-wrapper">
    <a href="#main-content" class="skip-link">Skip to content</a>

    <!--
      The WebGL scene is a fixed backdrop the document scrolls over; its meshes
      are positioned from each tracked element's viewport rect, so it must not
      scroll with the content.
    -->
    <ClientOnly>
      <ThreeScrollCanvas />
    </ClientOnly>

    <header>
      <TopBar class="z-50" />
    </header>

    <!-- TODO: <Preloader /> -->
    <main id="main-content" class="relative z-10" tabindex="-1">
      <slot />
    </main>

    <!-- BottomBar will be replaced with different component later and moved to child elements -->
    <BottomBar class="z-50" />
    <ScrollTrack />
  </div>
</template>
