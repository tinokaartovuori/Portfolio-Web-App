# Architecture

This file documents the architecture of this repository for anyone working on it.

## Project goal

Tino Kaartovuori's personal portfolio site. The ambition is a world-class, award-site-level portfolio: heavy custom motion/WebGL design built with modern web tooling.

Development was active Jan–May 2023, paused, and resumed in September 2026 with a modernization pass: the stack is current (Nuxt 4, three 0.185, Tailwind 4), scrolling was rebuilt on native scroll + Lenis, and content moved into a content layer.

**The copy and images in `content/` are sample content and are meant to be replaced.** The structure around them is real. `content/README.md` is written for whoever edits the site rather than the code, and is the right place to point someone who just wants to change text or swap an image.

Still open:

- **No real portfolio content.** The projects in `content/projects/` are plausible samples, not Tino's actual work.
- **No preloader.** `layouts/default.vue` has a TODO for it; note that adding one changes what is mounted on first paint, so re-check the frame loop's stage order if you build it.
- **The glass/refraction work is not started.** The scene still has no lights, no environment map and no tone mapping — every material is unlit. The hooks are in place (`scene` for lights and `environment`, `Scenario.enablePostProcessing()` for screen-space passes, real 3D tilt on the images so lighting will read), but it remains a prerequisite chain, not a tuning job.
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

**Every number that decides how the site feels lives in `motion.config.ts`** — scroll spring and speed cap, keyboard step, rubber-band stiffness, image trail, bubble depth, hover lift, lens size. Tune there; the motion code reads it and nothing else should carry a magic constant.

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

- `<ElementTracker threeReference="uniqueId" object="IntroRectangle">` — registers its **first slot child** and a string naming which Three class to instantiate.
- `<ThreeImage threeReference="uniqueId" imageUrl="…" alt="…" />` — renders an `opacity-0` `<img>` (it exists only to be measured and to supply the texture URL, but stays in the accessibility tree) and registers it.

The registry is global and keyed by `threeReference`, so **`threeReference` has to be unique across both trackers combined** — `remove()` is keyed globally and looks in both maps. In development a duplicate logs a warning naming the id. Both wrappers deregister themselves on unmount, so a page does not need `threeObjectStateStore.reset()`; the calls the existing pages make are harmless.

### 5. The single WebGL host

`components/ThreeScrollCanvas.vue` is mounted once in `layouts/default.vue` inside `<ClientOnly>` and owns everything Three:

- `three-components/Scenario.ts` — scene + perspective camera + renderer. The camera math is the crux of the DOM↔WebGL mapping: with `perspective = 1000` and `fov = 2·atan(height/2/perspective)`, **one world unit equals one CSS pixel** at z=0, so meshes can be positioned directly from `getBoundingClientRect()`.
- `three-components/ImageManager.ts` → builds a `WavyImage` per registered image.
- `three-components/ElementManager.ts` → maps the `object` string to a class through the `OBJECT_TYPES` lookup table. **Adding an element type is one entry there** — the `satisfies` on that literal turns a class that has drifted from the lifecycle into a compile error on the entry rather than a method that throws on the first frame. An unrecognised name renders nothing and warns in development. It also exports `TrackedObject3D`, the interface every element class has to satisfy, and `TrackedObjectName`, the union of valid `object` prop values.

Update flow, all via `watch`:

- `onFrame('transform')` → fills one reused `FrameContext` (`three-components/FrameContext.ts`: `dt`, `time`, `scroll` = `scrollFrame`, `pointer` = `pointerFrame`, `reduced`) and calls `imageManager.updateImages(ctx)` + `elementManager.updateElementPositions(ctx)`
- `onFrame('render')` → `scenario.render()` — straight to the canvas, or through an `EffectComposer` when `scenario.enablePostProcessing(passes)` has been called (RenderPass → your passes → OutputPass, on a multisampled half-float target). Off by default (`POST_PROCESSING` in the canvas component) because it costs a full-screen target per frame; it is the hook for bloom, blur and glass. The renderer states `outputColorSpace = SRGBColorSpace` and `toneMapping = NoToneMapping` explicitly; when tone mapping goes on, OutputPass applies it to the photographs too.
- `composables/usePointer.ts` → `pointerFrame`, the plain `{ x, y, hover, active }` cursor state the meshes read. `hover` is true only for a fine pointer that can hover, so a finger never triggers hover physics.
- `watch([width, height])` (from `useWindowSize`, 100ms trailing debounce) → full update + camera/renderer resize
- `watch(threeObjectState)` → tear down and rebuild all meshes (page navigation)
- `onUnmounted` → unregister both frame callbacks, drop every mesh and dispose the renderer

The canvas wrapper is `fixed inset-0 z-0`; page content sits above it at `z-10`. Nothing here relies on a third-party stylesheet for stacking any more.

### 6. Positioning convention for 3D objects

Every object class (`WavyImage`, `IntroRectangle`) repeats the same pattern — copy it when adding new ones:

```ts
const { width, height, top, left } = element.getBoundingClientRect()
sizes.set(width, height)
offset.set(
  left - window.innerWidth / 2 + width / 2, // viewport-center-relative X
  -top + window.innerHeight / 2 - height / 2, // Y, flipped for WebGL
)
```

An element class **is** the mesh — it extends `Mesh` rather than wrapping one in an `Object3D`, so there is no inner node to keep in sync and `this.geometry` / `this.material` are the typed pair three already maintains. It has to expose `update()` (full re-measure, effects at rest), `updatePosition(ctx)` (per frame), `updateAspectRatio()` and `dispose()`: that is the `TrackedObject3D` interface `ElementManager` types its array with, so a missing method is a compile error. `ImageManager` is the outlier: it stores `WavyImage[]` and calls `update(ctx)`, `resize()` and `dispose()`, which is the smaller `DomPinnedMesh` contract `WavyImage` implements.

**The DOM box is a target, not a position.** The `<img>` a `WavyImage` follows is invisible, so the mesh is free to deviate from it by a few tens of pixels, and the physics live in that freedom: the mesh trails the box through a spring (`lag`), bends by a share of that trail, recedes in z while scrolling fast, drifts a few pixels at rest, and under a fine pointer lifts toward the camera, tilts toward the cursor and shows a gaussian "liquid lens" (a vertex bulge plus a UV magnification and radial chromatic aberration). Every one of those is a `Spring` or a `damp()` fed by the `FrameContext`, so all of it settles the same way at 60 and 144 Hz, and every amount is a number in `motion.config.ts`. `IntroRectangle` gets the same trail with a smaller amplitude. Under `ctx.reduced` every class snaps to its box and does nothing else.

**Where an image is on screen decides how it moves.** The vertex shader gets the plane's centre and size in viewport units (`uScreenCenter`, `uScreenSize`, viewport spanning [-1, 1]) and computes each vertex's own screen position. While scrolling, the page behaves as a bubble seen face-on: vertices near the viewport centre come toward the camera and those near the edges go away (`bubble.depth`), each mesh tilts away from the centre and drifts outward in proportion to its screen offset (`bubble.tilt`, `bubble.spread`), and the trail sags on the side of the plane nearer the centre — so a left-hand image and a right-hand one deform as mirror images, and an image changes shape as it travels up the screen. All of it is scaled by `energy`, the smoothed scroll magnitude (`energySmoothing`, slower than the velocity smoothing so the bubble swells and relaxes as one motion instead of pulsing with each wheel notch). At rest the mesh sits exactly on its box.

`WavyImage.ts` keeps its shaders as inline template strings, not separate `.glsl` files. The fragment shader ends with `#include <colorspace_fragment>`, which pairs with `texture.colorSpace = SRGBColorSpace` — one without the other double-encodes the image — and does the right thing under an `EffectComposer` too (linear target, `OutputPass` encodes).

### 7. Content

Text and images come from `content/`, typed by `content.config.ts` (Nuxt Content v3):

- `content/home.yml` → the `home` **data** collection (hero copy, section headings)
- `content/projects/*.md` → the `projects` **page** collection (frontmatter is the card, body is the project page)
- `content/about.md` → the `about` **page** collection

Pages query with `queryCollection(...)` inside `useAsyncData`, and `<ContentRenderer>` renders markdown bodies.

**The constraint that shapes all of this:** the WebGL layer does not read data, it reads laid-out DOM boxes. A content field is only visible to the scene once it has been rendered as a real element wrapped in `<ElementTracker>` or `<ThreeImage>`. Adding a field that never reaches the DOM adds nothing to the canvas.

Two consequences worth knowing before changing the content layer:

- `threeReference` must be unique across `ElementTracker` **and** `ThreeImage` combined — the registry's `remove()` is keyed globally across both maps. Generated ids should be prefixed per kind. A collision logs a dev-only warning.
- The scene rebuild is batched to one `nextTick`, so a burst of registrations costs one rebuild. Items arriving in _separate_ ticks still cost one rebuild each — await a whole collection before rendering its trackers.

Images referenced from content must be same-origin (i.e. under `public/`). They are loaded into a WebGL texture, so a cross-origin URL without CORS headers fails and the element collapses to zero size.

### 8. The fixed bars and the hero

`TopBar` and `BottomBar` are `Bar` components hung from the viewport edge at `--bar-offset`, with `--bar-height` for what they hold and `--bar-safe` for the sum; all three are CSS variables in `index.css`, stepped per breakpoint. `Bar` can carry a `.bar-veil`: a solid page-colour band under a long gradient mask (`mask-image`, so the global 600ms colour transition carries it through a theme switch), reaching from the viewport edge to `--bar-safe + 5rem`, so content scrolling under the name and the navigation fades out instead of colliding with them. Only the top bar uses it (`BottomBar` passes `veil: false`: the scroll prompt is gone before any content reaches it). The veil stays off while over the hero: `Bar` compares the hero's bottom edge (from `heroHeight` in the scroll store, set by the page) with the veil's bottom edge and fades it in once the hero has scrolled past, i.e. as the first content passes under the bar. On a page without a hero it is on from the start. The same trigger slides the top bar up to `--bar-offset-compact` (`compact` prop, a transform so it stays on the compositor) to give the scrolled page more room; over the hero it sits at `--bar-offset`. Both states are gated on `mounted`: the layout renders the bars before the page's setup has announced its hero, and a server-rendered "on" would survive hydration (class mismatches are check-only), so the server and the hydrating client always render "off". The home page announces its hero as `Infinity` before its first `await` and replaces that with the measured height. Per-control halos and a bottom veil were both tried and dropped.

The hero on the home page pads itself past `--bar-safe` on both edges, so its text sits between the bars at every viewport. When it still cannot fit (a landscape phone, a small window: the section's border box grows past the viewport), the page sets `scrollPromptSuppressed` on the scroll store and `BottomBar` hides the prompt rather than letting it land on the text. A page that sets the flag clears it on unmount.

### 9. Theming and assets

- Dark/light via `@nuxtjs/color-mode` with `classSuffix: ''`, matching Tailwind's `darkMode: 'class'`. `ThemeSwitch.vue` writes `useColorMode().preference` and reads the resolved `useColorMode().value` back for the switch position. Custom palette is just two colors: `onyx` (#0c0d12) / `platinum` (#dde0ed); the global 600ms color transition in `index.css` is what makes theme switching feel smooth.
- Google Fonts (Outfit) are **downloaded and inlined as base64** into `assets/fonts/` by `@nuxtjs/google-fonts` (`overwriting: false`). Treat that directory as generated — never hand-edit it, and don't grep it (the base64 blobs will flood results).
- SVGs import as components via `vite-svg-loader`: `import Icon from '../assets/icons/sun.svg?component'`.
- `@` and `~` both alias the project root.

## Known rough edges

- Import gsap as `import { gsap } from 'gsap'`. The default import resolves to the CJS bundle's `module.exports` under Node ESM, where `gsap.timeline` is undefined — every page then 500s during SSR while working fine in the browser.
- `npx prettier --check .` fails on most files: the installed `prettier-plugin-tailwindcss` sorts Tailwind classes differently from the version that originally formatted the repo. Pre-existing drift; it wants a single dedicated `npm run format` commit, landed on its own so it does not bury real diffs.
- No `.gitattributes` and `core.autocrlf=true`, so the working tree is a mix of CRLF and LF. Prettier's default `endOfLine: 'lf'` flags every CRLF file even when the content is already formatted.
- No `favicon.ico` in `public/`, and no page has an `<h1>` except `error.vue`.
- `layouts/default.vue` has a `TODO: <Preloader />`; `pages/about.vue` is a stub.
- `package.json` still lists the `url` shim as a dependency; nothing imports it since `nuxt.config.ts` switched to `node:url`.
