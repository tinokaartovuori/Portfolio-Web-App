<template>
  <div id="app-wrapper">
    <a href="#main-content" class="skip-link">Skip to content</a>

    <!-- `?perf` shows the frame meter: the bisect kit for a phone that
         cannot be profiled from the desk (with `?gl=0` below) -->
    <ClientOnly>
      <PerfMeter v-if="route.query.perf !== undefined" />
    </ClientOnly>

    <header>
      <TopBar />
    </header>

    <!--
      One Lenis instance for the whole app. Mounted per page it was created
      and destroyed on every navigation, and the outgoing instance's teardown
      could zero the shared frame state after the incoming one had started.
      The footer is a sibling of main, not inside it, so the page has a
      top-level contentinfo landmark; both are still inside ScrollContainer,
      because everything that scrolls must be (nothing fixed may).
    -->
    <ScrollContainer>
      <!--
        The WebGL scene, in the scrolled document so the compositor carries
        it with the page between JS frames (see the component); it puts
        itself over the viewport every frame. Lazy, so three.js is not on the
        path to hydration: the chunk is fetched by plugins/three-warm.client.ts
        alongside it and the component mounts once both are in. Until then,
        and with `?gl=0`, the page is the CSS plates and the imgs.
      -->
      <ClientOnly>
        <LazyThreeScrollCanvas v-if="route.query.gl !== '0'" />
      </ClientOnly>
      <main id="main-content" class="relative z-10" tabindex="-1">
        <slot />
      </main>
      <SiteFooter />
    </ScrollContainer>

    <!-- BottomBar will be replaced with different component later and moved to child elements -->
    <BottomBar />
    <ScrollTrack />
    <!-- The grain over everything, bars included; fixed, so a sibling of main -->
    <NoiseOverlay />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()

// A page with a title gets it appended with the name; a page with none (the
// home page, the error page) keeps the default tagline title. A function
// title template belongs in useHead, not the static head in nuxt.config.
useHead({
  titleTemplate: (title?: string) =>
    title
      ? `${title} · Tino Kaartovuori`
      : 'Tino Kaartovuori — Software engineer, Salo, Finland: web, AI, hardware',
})
</script>
