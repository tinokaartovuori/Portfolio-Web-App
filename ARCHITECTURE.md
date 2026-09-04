# Architecture

This file documents the architecture of this repository for anyone working on it.

## Project goal

Tino Kaartovuori's personal portfolio site. The ambition is a world-class, award-site-level portfolio: heavy custom motion/WebGL design built with modern web tooling.

Development was active Jan–May 2023, paused, and resumed in September 2026 with a modernization pass: the stack is current (Nuxt 4, three 0.185, Tailwind 4), scrolling was rebuilt on native scroll + Lenis, and content moved into a content layer.

**The copy and images in `content/` are sample content and are meant to be replaced.** The structure around them is real. `content/README.md` is written for whoever edits the site rather than the code, and is the right place to point someone who just wants to change text or swap an image.

Still open:

- **No real portfolio content.** The projects in `content/projects/` are plausible samples, not Tino's actual work.
- **No preloader.** `layouts/default.vue` has a TODO for it; note that adding one changes what is mounted on first paint, so re-check the frame loop's stage order if you build it.
- **The glass/refraction work is not started.** The scene still has no lights, no environment map and no tone mapping — every material is unlit. That is a prerequisite chain, not a tuning job.

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

`dt` is in seconds and clamped to 1/30. `damp(current, target, lambda, dt)` from the same module is the only easing helper you should use; `x += (target - x) * k` decays per _frame_ and so behaves differently at 60, 120 and 144 Hz.

### 2. Scrolling is native, smoothed by Lenis

The page scrolls natively. `components/ScrollContainer.vue` creates a Lenis instance (`composables/useSmoothScroll.ts`) with `autoRaf: false` and drives it from the frame loop's `scroll` stage. Keyboard, find-in-page, anchors, scroll restoration and pinch zoom therefore all work without any code.

`composables/useSmoothScroll.ts` also exports `scrollFrame` — a **plain, non-reactive** `{ y, velocity, max }`. The WebGL layer reads this directly; Vue reactivity does not belong in a 120 Hz path. `velocity` is in **pixels per second**.

Under `prefers-reduced-motion: reduce`, Lenis is created with `lerp: 1` and `smoothWheel: false`, i.e. plain native scrolling.

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

- `onFrame('transform')` → `imageManager.updateImages(scrollFrame.velocity, dt)` + `elementManager.updateElementPositions()`
- `onFrame('render')` → `scenario.render()`
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

An element class **is** the mesh — it extends `Mesh` rather than wrapping one in an `Object3D`, so there is no inner node to keep in sync and `this.geometry` / `this.material` are the typed pair three already maintains. It has to expose `update()`, `updatePosition()`, `updateAspectRatio()` and `dispose()`: that is the `TrackedObject3D` interface `ElementManager` types its array with, so a missing method is a compile error. `ImageManager` is the outlier: it stores `WavyImage[]` and only ever calls `update()` and `dispose()`, which is the smaller `DomPinnedMesh` contract `WavyImage` implements.

`WavyImage.ts` holds the signature effect: a `ShaderMaterial` with inline GLSL whose vertex shader bends the plane by smoothed scroll speed (`uScrollSpeed`, lerped by `smoothingFactor`) and by the plane's normalized viewport Y (`uPlaneYPosition`). Shaders are inline template strings, not separate `.glsl` files.

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

### 8. Theming and assets

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
