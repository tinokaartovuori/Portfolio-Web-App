<template>
  <!--
    Film grain over the whole viewport: DOM text and the WebGL canvas alike,
    which is what makes it read as a surface rather than a rendering artefact.
    A DOM overlay rather than a post-processing pass, which would cost a
    full-screen render target every frame and grain only the canvas.
  -->
  <div aria-hidden="true" class="grain pointer-events-none fixed z-[60]"></div>
</template>

<style scoped>
/*
 * The noise is turned into sparse grains rather than a grey haze: the colour
 * matrix maps the noise to a flat colour whose alpha is 0 for most values and
 * rises only for the brightest, so it adds speckle without lifting the page
 * colour. A blend mode would not do: `overlay` on near-black is near-zero.
 * Black grains on the light page, white on the dark one.
 */
.grain {
  /* A box twice the viewport, so the animation can wander without exposing an edge */
  inset: -50%;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.05' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4 0 0 0 -2.4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 256px 256px;
  opacity: 0.09;
  will-change: transform;
  /* A transform, not background-position: it stays on the compositor */
  animation: grain 1s steps(5) infinite;
}

.dark .grain {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.05' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  4 0 0 0 -2.4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  opacity: 0.13;
}

@keyframes grain {
  0% {
    transform: translate3d(0, 0, 0);
  }
  20% {
    transform: translate3d(-4%, -7%, 0);
  }
  40% {
    transform: translate3d(6%, 3%, 0);
  }
  60% {
    transform: translate3d(-2%, 8%, 0);
  }
  80% {
    transform: translate3d(7%, -4%, 0);
  }
  100% {
    transform: translate3d(3%, 6%, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .grain {
    animation: none;
  }
}
</style>
