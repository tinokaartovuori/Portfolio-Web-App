# Architecture

This file documents the architecture of this repository for anyone working on it.

## Project goal

Tino Kaartovuori's personal portfolio site. The ambition is a world-class, award-site-level portfolio: heavy custom motion/WebGL design built with modern web tooling.

Development was active Jan–May 2023, paused, and resumed in September 2026 with a modernization pass: the stack is current (Nuxt 4, three 0.185, Tailwind 4), scrolling was rebuilt on native scroll + Lenis, and content moved into a content layer.

**The copy and images in `content/` are sample content and are meant to be replaced.** The structure around them is real. `content/README.md` is written for whoever edits the site rather than the code, and is the right place to point someone who just wants to change text or swap an image.

Still open:

- **No real portfolio content.** The projects in `content/projects/` are plausible samples, not Tino's actual work.
- **No preloader.** `layouts/default.vue` has a TODO for it; note that adding one changes what is mounted on first paint, so re-check the frame loop's stage order if you build it.
- **The glass/refraction work is not started.** The scene still has no lights, no environment map and no tone mapping — every material is unlit (a lit backdrop with point lights on standard materials was built and taken out again; see section 10). The hooks are in place (`scene` for lights and `environment`, `Scenario.enablePostProcessing()` for screen-space passes, real 3D tilt on the images so lighting will read), but it remains a prerequisite chain, not a tuning job.
- **Touch overscroll is untested on a real iPhone.** The rubber band was verified with synthetic touch events in Chromium; iOS Safari's own bounce may or may not honour `overscroll-behavior: none` on the root, and the band's stand-down guard for that case has only been reasoned about, not observed.

## Commands

```bash
npm run dev        # dev server on :3000 (HMR on :24678)
npm run build      # production build
npm run generate   # static generation
npm run preview    # preview a build
npm run typecheck  # nuxt typecheck (vue-tsc, strict)
npm run format     # prettier --write . (the only formatting/lint gate)
```

**Node >= 22.12 is required** (`engines`), and this is a hard failure rather than a warning: on older Node the build dies with `oxc-walker: could not resolve a parseSync implementation`. Nuxt Content is configured with `content.experimental.sqliteConnector: 'native'` so it uses Node's built-in `node:sqlite` — do **not** install `better-sqlite3`, it is not needed and would add a native compile step on Windows.

There are **no tests and no ESLint config** in this repo — don't go looking for them, and don't invent a test command. `npm run typecheck` is clean and must stay that way. Prettier is the only enforced style tool (`.prettierrc.json`: no semicolons, single quotes, 2-space, trailing commas; `prettier-plugin-tailwindcss` sorts Tailwind classes).

Note: `Dockerfile` pins `node:14-alpine` and `docker-compose.yml` builds from it. That cannot run this stack at all, and Docker buys nothing for a site that is meant to be prerendered — the files are stale and are candidates for deletion rather than repair.

## Architecture

The whole site is one idea: **a Three.js scene rendered behind the DOM, whose meshes are pinned 1:1 to the on-screen positions of real HTML elements, advanced by one shared clock.** Understanding that pipeline is most of understanding this codebase.

### 1. One clock drives everything

`composables/useFrameLoop.ts` owns the single `gsap.ticker` callback and runs registered callbacks in a fixed order every frame:

1. `scroll` — advance Lenis, publish position and velocity
2. `transform` — measure and place meshes against the position scroll just produced
3. `render` — draw

Register with `onFrame(stage, cb)` (returns an unregister) or `useFrame(stage, cb)` (unregisters on unmount). **Never add your own `requestAnimationFrame` or `gsap.ticker.add` for anything that has to agree with scroll position** — that is exactly the desync this replaced.

`dt` is in seconds and clamped to 1/30. Two easing helpers exist and you should not write a third: `damp(current, target, lambda, dt)` from the same module for anything that only needs to approach a target, and `Spring` from `utils/spring.ts` (Framer-style `stiffness` / `damping` / `mass`, substepped semi-implicit Euler) for anything that should have mass and overshoot. `x += (target - x) * k` decays per _frame_ and so behaves differently at 60, 120 and 144 Hz.

Two small helpers sit on top of those and are shared by everything scroll- or cursor-driven: `ScrollFeel` (`utils/scrollFeel.ts`) turns the raw scroll velocity into a smoothed `velocity`, a tanh-saturated signed `drive` and a more slowly smoothed `energy`, so the images, the light fields, the glow plates and the marquee agree on what "fast" is; `cursorUvIn` (`utils/cursorUv.ts`) is the allocation-free "where is the pointer over this box, in UV" test.

**Every number that decides how the site feels lives in `motion.config.ts`** — scroll spring and speed cap, keyboard step, rubber-band stiffness, the shared scroll feel, the theme blend rate, the palette, the page trail shares, image trail, bubble depth, hover lift, lens size, glitch, film grain, the light fields, the line bands, wire shapes, index rows, marquee and magnetic pull. Tune there; the motion code reads it and nothing else should carry a magic constant.

### 2. Scrolling is native, driven by a spring, with a rubber band at the edges

The page scrolls natively. `components/ScrollContainer.vue` calls `createSmoothScroll` (`composables/useSmoothScroll.ts`), which runs in the frame loop's `scroll` stage. Find-in-page, scroll restoration and pinch zoom therefore work without any code.

**The integrator is ours, not Lenis'.** Wheel deltas (and keyboard: arrows, Page Up/Down, Space, Home, End; and same-page anchor clicks) move a _target_; the scroll position is a critically damped, velocity-capped `Spring` chasing that target, written to `window.scrollTo` every frame. Lenis' own lerp was measured and rejected: a first-order lerp restarts its velocity on every wheel notch (per-frame deltas went 8 → 11 → 14 → 15 px, one step per notch), which reads as a series of shoves; the spring keeps velocity continuous so notches blend into one swell. Lenis is still created (`lerp: 1`, `smoothWheel: false`) for what it does well — `limit` with its resize observers, the touch gesture stream, iOS quirks, the optional `syncTouch` mode — and its `virtualScroll` hook is where wheel deltas are taken over (`return false`) and touch deltas are watched. A scroll position the integrator did not write (a finger, the scrollbar, a restored position, find-in-page) is adopted as the new truth on the next frame, so it never fights the browser. Under reduced motion the integrator is bypassed and everything is native.

**The rubber band.** Native scroll cannot go past its own edges, so `useSmoothScroll` translates the `ScrollContainer` wrapper instead (`transform: translate3d(0, overscroll, 0)`), driven by a second `Spring`. Three things feed it: wheel deltas past an edge (accumulated, then released at `overscroll.release` so the band eases home instead of snapping), a finger dragging past an edge (held while the finger is down, released into the spring on `touchend`), and momentum arriving at an edge (a share of the arrival velocity becomes a spring impulse — but only below `bounceMaxVelocity`, so a scroll-restoration jump lands dead; the integrator's own approach decelerates and never bounces). The meshes follow for free because they measure the translated DOM. The transform is removed entirely at rest so the document does not sit on a compositing layer. If iOS is ever observed rubber-banding natively (scroll position leaves `[0, max]`), the band stands down for the rest of the session rather than doubling the bounce. Two rules follow: everything that scrolls must live inside `ScrollContainer`, and nothing `position: fixed` may, because a transformed ancestor becomes its containing block.

`composables/useSmoothScroll.ts` also exports `scrollFrame` — a **plain, non-reactive** `{ y, velocity, max, overscroll, reduced }`. The WebGL layer reads this directly; Vue reactivity does not belong in a 120 Hz path. `velocity` is in **pixels per second** and is the velocity of the content _as seen_, i.e. it includes the rubber band, so a bounce deforms the images just like a scroll does. `y` stays within `[0, max]`.

Under `prefers-reduced-motion: reduce`, Lenis is created with `lerp: 1` and `smoothWheel: false`, i.e. plain native scrolling, and the rubber band never engages.

Touch scrolling stays native (`syncTouch: false`): it stays on the compositor, and the band gives it the bounce anyway. `motion.config.ts` has the switch if identical Lenis inertia on touch is ever wanted.

The OS scrollbar is hidden in CSS; `components/ScrollTrack.vue` draws the visible track/indicator from store state in the frame loop's `render` stage.

### 3. Pinia stores are the bus between DOM and WebGL

- `store/scrollState.ts` — `scrollY`, `scrollYVelocity` (**pixels per second**), `scrollYMax`. Mirrored once per frame from `scrollFrame` by `ScrollContainer`, for the _reactive_ consumers only (`ScrollTrack`, `BottomBar`). `ThreeScrollCanvas` does not read it.
- `store/threeObjectState.ts` — registry of DOM elements that want a 3D counterpart: `threeElementTracker` (element + object-type string) and `threeImageTracker` (image elements). `reset()` clears both; `remove(threeReference, element?)` drops a single entry — pass the node and it is only dropped if the registry still holds that exact one, so a component that lost its id to a duplicate cannot delete the winner's entry on its own unmount.

### 4. Registering DOM elements for WebGL

Two wrapper components register into `threeObjectState` on mount:

- `<ElementTracker threeReference="uniqueId" object="LightField" variant="hero">` — registers its **first slot child** and a string naming which Three class to instantiate. The optional `variant` is handed to that class's constructor as a second argument, for classes that come in presets (the hero and the footer are both a `LightField`; a `GlowPlate` is `accent` or `cool`). Attributes on the tracker fall through to its own `<div>`, which is what the parent lays out — put layout classes there, not on the child.
- `<ThreeImage threeReference="uniqueId" imageUrl="…" alt="…" />` — renders an `opacity-0` `<img>` (it exists only to be measured and to supply the texture URL, but stays in the accessibility tree) and registers it.

The registry is global and keyed by `threeReference`, so **`threeReference` has to be unique across both trackers combined** — `remove()` is keyed globally and looks in both maps. In development a duplicate logs a warning naming the id. Both wrappers deregister themselves on unmount, so a page does not need `threeObjectStateStore.reset()`; the calls the existing pages make are harmless.

### 5. The single WebGL host

`components/ThreeScrollCanvas.vue` is mounted once in `layouts/default.vue` inside `<ClientOnly>` and owns everything Three:

- `three-components/Scenario.ts` — scene + perspective camera + renderer. The camera math is the crux of the DOM↔WebGL mapping: with `perspective = 1000` and `fov = 2·atan(height/2/perspective)`, **one world unit equals one CSS pixel** at z=0, so meshes can be positioned directly from `getBoundingClientRect()`.
- `three-components/ImageManager.ts` → builds a `WavyImage` per registered image.
- `three-components/ElementManager.ts` → maps the `object` string to a class through the `OBJECT_TYPES` lookup table (`LightField`, `WireShape`). **Adding an element type is one entry there** — the `satisfies` on that literal turns a class that has drifted from the lifecycle into a compile error on the entry rather than a method that throws on the first frame. An unrecognised name renders nothing and warns in development. It also exports `TrackedObject3D`, the interface every element class has to satisfy, and `TrackedObjectName`, the union of valid `object` prop values.

Update flow, all via `watch`:

- `onFrame('transform')` → fills one reused `FrameContext` (`three-components/FrameContext.ts`: `dt`, `time`, `scroll` = `scrollFrame`, `pointer` = `pointerFrame`, `reduced`, `theme`, `heroHeight` from the scroll store) and calls `imageManager.updateImages(ctx)` + `elementManager.updateElementPositions(ctx)`. `theme` is 0 for light and 1 for dark, damped toward the resolved `useColorMode().value` at `motion.theme.smoothing` so it crosses over in the same ~600 ms as the CSS colour transition (snapped under reduced motion, where the CSS transition is 1 ms); a class that blends two palettes by it fades with the page instead of switching.
- `onFrame('render')` → `scenario.render()` — straight to the canvas, or through an `EffectComposer` when `scenario.enablePostProcessing(passes)` has been called (RenderPass → your passes → OutputPass, on a multisampled half-float target). Off by default (`POST_PROCESSING` in the canvas component) because it costs a full-screen target per frame; it is the hook for bloom, blur and glass. The renderer states `outputColorSpace = SRGBColorSpace` and `toneMapping = NoToneMapping` explicitly; when tone mapping goes on, OutputPass applies it to the photographs too.
- `composables/usePointer.ts` → `pointerFrame`, the plain `{ x, y, hover, active }` cursor state the meshes read. `hover` is true only for a fine pointer that can hover, so a finger never triggers hover physics.
- `three-components/LineBands.ts` → the one thing in the scene not pinned to an element, owned directly by the canvas component: bands of parallel lines flowing through the depth behind the page (section 10). It is updated after the managers in the `transform` stage, told about resizes, and disposed with the rest.
- `watch([width, height])` (from `useWindowSize`, 100ms trailing debounce) → full update + camera/renderer resize
- `watch(threeObjectState)` → tear down and rebuild all meshes (page navigation)
- `onUnmounted` → unregister both frame callbacks, drop every mesh and dispose the renderer

The canvas wrapper is `fixed inset-0 z-0`; page content sits above it at `z-10`. Nothing here relies on a third-party stylesheet for stacking any more.

### 6. Positioning convention for 3D objects

Every object class (`WavyImage`, `LightField`, `WireShape`) repeats the same pattern — copy it when adding new ones:

```ts
const { width, height, top, left } = element.getBoundingClientRect()
sizes.set(width, height)
offset.set(
  left - window.innerWidth / 2 + width / 2, // viewport-center-relative X
  -top + window.innerHeight / 2 - height / 2, // Y, flipped for WebGL
)
```

An element class **is** the mesh — it extends `Mesh` rather than wrapping one in an `Object3D`, so there is no inner node to keep in sync and `this.geometry` / `this.material` are the typed pair three already maintains. It has to expose `update()` (full re-measure, effects at rest), `updatePosition(ctx)` (per frame), `updateAspectRatio()` and `dispose()`: that is the `TrackedObject3D` interface `ElementManager` types its array with, so a missing method is a compile error. `ImageManager` is the outlier: it stores `WavyImage[]` and calls `update(ctx)`, `resize()` and `dispose()`, which is the smaller `DomPinnedMesh` contract `WavyImage` implements.

All of them are a `PlaneGeometry(1, 1)` scaled to the box in pixels, so UVs are 0–1 by construction; shapes such as the light field's rounded corners are a signed-distance mask in the fragment shader, fed the size in px through a uniform that has to be refreshed on every measure. A mesh placed **off the z=0 plane** that still has to match a DOM box has to multiply its position and size by `(PERSPECTIVE + depth) / PERSPECTIVE` to keep the footprint the box describes — `Scenario.ts` exports the constant; the line bands deliberately do not, since their perspective is the point. A mesh with real depth (`WireShape`) is seen from an angle at the side of the viewport and looks sheared there; it calls `lookAt` on the camera before applying its own turn, so it reads the same everywhere on the page. Grain lives inside the shaders, never over the page: a still per-pixel hash in the light field's lit parts (frost) and a faint re-rolled one inside the photographs (film), both from a sine-free hash, because the classic `fract(sin(dot(…)))` shows its period on some GPUs. The decorative materials are `transparent` with `depthWrite: false`, straight alpha over the clear-alpha-0 canvas; three draws the opaque images first and the transparent meshes after, and a plate deeper than the image can ever recede needs no `renderOrder`. Every fragment shader that writes a `Color` uniform ends with `#include <colorspace_fragment>`, for the same reason `WavyImage`'s does. The scene is rebuilt on every registration, so nothing in a class may depend on per-instance random state (the light orbits are phased by index) and the theme is read from `ctx.theme` each frame, never cached at construction.

**The DOM box is a target, not a position.** The `<img>` a `WavyImage` follows is invisible, so the mesh is free to deviate from it by a few tens of pixels, and the physics live in that freedom: the mesh trails the box through a spring (`lag`), bends by a share of that trail, recedes in z while scrolling fast, drifts a few pixels at rest, and under a fine pointer lifts toward the camera, tilts toward the cursor and shows a gaussian "liquid lens" (a vertex bulge plus a UV magnification and radial chromatic aberration). Every one of those is a `Spring` or a `damp()` fed by the `FrameContext`, so all of it settles the same way at 60 and 144 Hz, and every amount is a number in `motion.config.ts`. Past a hard scroll (`|drive|` over `image.glitch.start`) the fragment shader also tears horizontal slices of the image sideways, re-rolling which slices and how far a few times a second so it flickers rather than slides. Under `ctx.reduced` every class snaps to its box and does nothing else.

**`LightField`** is the frosted-glass light behind the hero (and, with the `footer` preset, the footer): a rounded plate whose fragment shader lays 3–5 gaussian lights over a faint tint of the opposite page colour, "over" rather than additive so the same shader reads on both themes. The lights sit evenly on a ring that turns slowly as a whole, each wobbling around its seat, and every one moves through a spring. While the pointer is over the plate the **nearest** light follows it; when the pointer leaves, that light stays where it was dropped — its displacement from its seat becomes an offset it carries on from — and drifts back toward its seat at `lightField.settle`, slowly enough to read as its own wandering. Scroll energy stretches and brightens the field; the plate keeps the trail the old rectangle had; colour and alpha are dithered, because on onyx the banding lives in the low-alpha tails. Palette and per-preset numbers are `motion.palette` and `motion.lightField`.

**`WireShape`** is the solid in each index row: a cube, a pyramid, an octahedron or a globe (the `variant`), drawn as a `LineSegments` child — from an `EdgesGeometry` for the polyhedra and a hand-built parallels-and-meridians geometry for the globe, since an `EdgesGeometry` of a sphere would draw every triangle. The mesh itself has an empty geometry and an invisible material, because `wireframe: true` would also draw every face diagonal. It sits exactly on its box (the box carries the page trail), turns slowly at rest and faster with the scroll, in the scroll's direction, and under the pointer grows, brightens and tips toward it. It draws in the text colour (`palette.base`), so it reads as typography.

**Where an image is on screen decides how it moves.** The vertex shader gets the plane's centre and size in viewport units (`uScreenCenter`, `uScreenSize`, viewport spanning [-1, 1]) and computes each vertex's own screen position. While scrolling, the page behaves as a bubble seen face-on: vertices near the viewport centre come toward the camera and those near the edges go away (`bubble.depth`), each mesh tilts away from the centre and drifts outward in proportion to its screen offset (`bubble.tilt`, `bubble.spread`), and the trail sags on the side of the plane nearer the centre — so a left-hand image and a right-hand one deform as mirror images, and an image changes shape as it travels up the screen. All of it is scaled by `energy`, the smoothed scroll magnitude (`energySmoothing`, slower than the velocity smoothing so the bubble swells and relaxes as one motion instead of pulsing with each wheel notch). At rest the mesh sits exactly on its box.

`WavyImage.ts` keeps its shaders as inline template strings, not separate `.glsl` files. The fragment shader ends with `#include <colorspace_fragment>`, which pairs with `texture.colorSpace = SRGBColorSpace` — one without the other double-encodes the image — and does the right thing under an `EffectComposer` too (linear target, `OutputPass` encodes).

### 7. Content

Text and images come from `content/`, typed by `content.config.ts` (Nuxt Content v3):

- `content/home.yml` → the `home` **data** collection (hero copy, the marquee words, section headings, the about teaser's labels, the footer's `contact` block)
- `content/projects/*.md` → the `projects` **page** collection (frontmatter is the card, body is the project page)
- `content/about.md` → the `about` **page** collection

Pages query with `queryCollection(...)` inside `useAsyncData`, and `<ContentRenderer>` renders markdown bodies. The two queries more than one component makes (`home`: the home page and the footer; `about`: the about page and the home page's teaser) go through `composables/useContent.ts`, because `useAsyncData` shares one payload per key but warns when two callers hand it different handler functions for the same key.

**The constraint that shapes all of this:** the WebGL layer does not read data, it reads laid-out DOM boxes. A content field is only visible to the scene once it has been rendered as a real element wrapped in `<ElementTracker>` or `<ThreeImage>`. Adding a field that never reaches the DOM adds nothing to the canvas.

Two consequences worth knowing before changing the content layer:

- `threeReference` must be unique across `ElementTracker` **and** `ThreeImage` combined — the registry's `remove()` is keyed globally across both maps. Generated ids should be prefixed per kind. A collision logs a dev-only warning.
- The scene rebuild is batched to one `nextTick`, so a burst of registrations costs one rebuild. Items arriving in _separate_ ticks still cost one rebuild each — await a whole collection before rendering its trackers.

Images referenced from content must be same-origin (i.e. under `public/`). They are loaded into a WebGL texture, so a cross-origin URL without CORS headers fails and the element collapses to zero size.

### 8. The fixed bars and the hero

`TopBar` and `BottomBar` are `Bar` components hung from the viewport edge at `--bar-offset`, with `--bar-height` for what they hold and `--bar-safe` for the sum; all three are CSS variables in `index.css`, stepped per breakpoint. `Bar` can carry a `.bar-veil`: a solid page-colour band under a long gradient mask (`mask-image`, so the global 600ms colour transition carries it through a theme switch), reaching from the viewport edge to `--bar-safe + 5rem`, so content scrolling under the name and the navigation fades out instead of colliding with them. Only the top bar uses it (`BottomBar` passes `veil: false`: the scroll prompt is gone before any content reaches it). The veil stays off while over the hero: `Bar` compares the hero's bottom edge (from `heroHeight` in the scroll store, set by the page) with the veil's bottom edge and fades it in once the hero has scrolled past, i.e. as the first content passes under the bar. On a page without a hero it is on from the start. The same trigger slides the top bar up to `--bar-offset-compact` (`compact` prop, a transform so it stays on the compositor) to give the scrolled page more room; over the hero it sits at `--bar-offset`. Both states are gated on `mounted`: the layout renders the bars before the page's setup has announced its hero, and a server-rendered "on" would survive hydration (class mismatches are check-only), so the server and the hydrating client always render "off". The home page announces its hero as `Infinity` before its first `await` and replaces that with the measured height. Per-control halos and a bottom veil were both tried and dropped.

The hero on the home page pads itself past `--bar-safe` on both edges, so its text sits between the bars at every viewport; below `md` its text is bottom-aligned, so on a phone in portrait it sits in the lower part of the screen above the scroll prompt and the light field has the upper part. When it still cannot fit (a landscape phone, a small window: the section's border box grows past the viewport), the page sets `scrollPromptSuppressed` on the scroll store and `BottomBar` hides the prompt rather than letting it land on the text. A page that sets the flag clears it on unmount.

### 9. Theming and assets

- Dark/light via `@nuxtjs/color-mode` with `classSuffix: ''`, matching Tailwind's `darkMode: 'class'`. `ThemeSwitch.vue` writes `useColorMode().preference` and reads the resolved `useColorMode().value` back for the switch position. Custom palette is just two colors: `onyx` (#0c0d12) / `platinum` (#dde0ed), plus one accent, `accent` (#d4708f, a muted rose — Tailwind's `pink-500` was too loud against them); the global 600ms color transition in `index.css` is what makes theme switching feel smooth, and the WebGL layer follows it through `FrameContext.theme` (section 5) with its own `[light, dark]` pairs in `motion.palette`.
- Google Fonts (Outfit) are **downloaded and inlined as base64** into `assets/fonts/` by `@nuxtjs/google-fonts` (`overwriting: false`). Treat that directory as generated — never hand-edit it, and don't grep it (the base64 blobs will flood results).
- SVGs import as components via `vite-svg-loader`: `import Icon from '../assets/icons/sun.svg?component'`.
- `@` and `~` both alias the project root.

### 10. The decorative layer

Everything below is decoration on top of the pipeline above; each piece reads `pointerFrame` / `scrollFrame` in the `render` stage and honours reduced motion and coarse pointers on its own. DOM components read `matchMedia` for both **after mount**, so the server and the hydrating client always render the "off" state.

Two things were tried and taken out again, and should not come back in the same form: a **film-grain overlay** over the whole viewport (its tiling and stepped animation read as a moving grid on a still page; grain now lives inside the shaders, section 6) and a **custom cursor** (a dot and a `difference`-blended ring; it drew attention away from the work).

- **The page trail** (`composables/useTrail.ts`) — one spring for the whole page, the images' own (`motion.image.lag`), integrated once per frame in the `transform` stage into the plain `trailFrame`; `useTrail(ref, share)` writes `share × trailFrame.y` to an element as a `y` transform in the `render` stage. Project text columns, the work heading, the about teaser, the index rows and the footer panel ride it, so text, rules, shapes and images lag and settle together as one body. The image columns are left alone: their meshes carry the trail themselves, and a trailed box under a trailing mesh would double it. A mesh pinned to a trailed element follows for free by measuring it (one frame behind, which a smoothed spring hides).
- **The line bands** (`three-components/LineBands.ts`) — the page's depth: a handful of bands, each a bundle of parallel lines that follow one smooth, slowly waving path across the viewport a few px apart, the spacing swelling and pinching along the way so the bundle fans open and closes. The path is a tilted line with three travelling sines on it, bent away from the pointer near it; every frame it is traced once per band with its normals, and each strand is rebuilt from it as a ribbon two vertices wide (the material is double-sided: the ribbon's winding follows its direction of travel, which the waves turn either way). The bands live at depths all **behind** the page and move with it in world space, so the parallax is the camera's own and nothing of them ever crosses an image; the near ones are drawn wide and blurred (a gaussian across the strand, and fainter, as a blur is), the far ones as crisp hairlines, which is what makes the depth read. Scrolling quickens the waves, the whole field rides a trail of its own, and all of it is index-derived so a rebuild does not reshuffle it. One colour, the text colour, at a low alpha, so it is the same thing on either theme. Anchored below the hero and faded in as it scrolls away (`heroHeight` in the `FrameContext`); a page without a hero has them from the top. Earlier attempts at the depth, in order: an "edge glow" sprite per image and a cloud of soft quads (both read as blurred rectangles), smooth pebble-like forms under saturated point lights (too colourful, a 3D showcase), a faceted lit surface (a wall), and free-drifting single filaments (too sparse, and the near ones crossed the images). What stayed is what moves, in rows.
- **Magnetic** (`composables/useMagnetic.ts`, `Magnetic.vue`) — an element pulled a little toward a nearby pointer through a near-critical spring and let go on leave. The pull is computed from the rest position (the rect minus the current translation), or the element would chase its own displacement. On the top bar controls, the hero CTA, the about teaser link and the footer email.
- **Index rows** (`ProjectIndex.vue`) — a box that a `WireShape` is pinned to, a rule that draws itself as the row enters the viewport, and the number in mono. Every other row is reversed (`flip`), so the solid alternates sides down the list and, on wide screens, sits opposite the image. Measured from the **row's** rect, never the rule's: a rect includes the element's own transform.
- **Marquee** (`Marquee.vue`) — a band of words between the hero and the work, holding the words twice so it loops; it runs on its own, the smoothed scroll velocity is added to it (down speeds it up, up slows or reverses it) and `drive` leans it over. The list is read once by assistive technology; the moving track is `aria-hidden`.
- **Footer** (`SiteFooter.vue`, in the layout **inside** `ScrollContainer`) — on every page. It contains nothing fixed, so it rides the rubber band and its `LightField` follows; its back-to-top link is a same-page anchor and glides through the scroll spring like `#work` does.

Anything `fixed` is a sibling of `<main>` in `layouts/default.vue`, like the bars; nothing fixed may go inside `ScrollContainer` (section 2).

## Known rough edges

- Import gsap as `import { gsap } from 'gsap'`. The default import resolves to the CJS bundle's `module.exports` under Node ESM, where `gsap.timeline` is undefined — every page then 500s during SSR while working fine in the browser.
- `npx prettier --check .` fails on most files: the installed `prettier-plugin-tailwindcss` sorts Tailwind classes differently from the version that originally formatted the repo. Pre-existing drift; it wants a single dedicated `npm run format` commit, landed on its own so it does not bury real diffs.
- No `.gitattributes` and `core.autocrlf=true`, so the working tree is a mix of CRLF and LF. Prettier's default `endOfLine: 'lf'` flags every CRLF file even when the content is already formatted.
- No `favicon.ico` in `public/`, and no page has an `<h1>` except `error.vue`.
- `layouts/default.vue` has a `TODO: <Preloader />`; `pages/about.vue` is a stub.
- `package.json` still lists the `url` shim as a dependency; nothing imports it since `nuxt.config.ts` switched to `node:url`.
