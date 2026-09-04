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
      <TopBar />
    </header>

    <!-- TODO: <Preloader /> -->
    <main id="main-content" class="relative z-10" tabindex="-1">
      <!--
        One Lenis instance for the whole app. Mounted per page it was created
        and destroyed on every navigation, and the outgoing instance's teardown
        could zero the shared frame state after the incoming one had started.
      -->
      <ScrollContainer>
        <slot />
      </ScrollContainer>
    </main>

    <!-- BottomBar will be replaced with different component later and moved to child elements -->
    <BottomBar />
    <ScrollTrack />
  </div>
</template>
