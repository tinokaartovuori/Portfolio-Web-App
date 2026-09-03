# Architecture

This file documents the architecture of this repository for anyone working on it.

## Project goal

Tino Kaartovuori's personal portfolio site. The ambition is a world-class, award-site-level portfolio: heavy custom motion/WebGL design built with modern web tooling. Two things are explicitly still open and not yet built:

- **Content is all placeholder.** `pages/index.vue` and `pages/about.vue` are Lorem ipsum, Flickr test images and empty `TestSection` spacers. There is no real portfolio content anywhere.
- **No CMS yet.** Content should eventually come from a CMS / content layer rather than being hardcoded in the page templates. When adding one, note that content nodes must still be plain DOM elements wrapped in `ElementTracker` / `ThreeImage` for the WebGL layer to pick them up (see below).

Development was active Jan–May 2023 and has been paused since; expect dependencies (Nuxt 3.1, Three 0.149) to be well behind current releases.

## Commands

```bash
npm run dev        # dev server on :3000 (HMR on :24678)
npm run build      # production build
npm run generate   # static generation
npm run preview    # preview a build
npm run typecheck  # nuxt typecheck (vue-tsc, strict)
npm run format     # prettier --write . (the only formatting/lint gate)
docker-compose up  # containerized dev server, same ports
```

There are **no tests and no ESLint config** in this repo — don't go looking for them, and don't invent a test command. `npm run typecheck` is clean and must stay that way. Prettier is the only enforced style tool (`.prettierrc.json`: no semicolons, single quotes, 2-space, trailing commas; `prettier-plugin-tailwindcss` sorts Tailwind classes).

Note: `Dockerfile` pins `node:14-alpine`, which is too old to actually run Nuxt 3 — the Docker path likely needs the base image bumped before it works.

## Architecture

The whole site is one idea: **a Three.js scene rendered behind the DOM, whose meshes are pinned 1:1 to the on-screen positions of real HTML elements, driven by a custom (non-native) scrollbar.** Understanding that pipeline is most of understanding this codebase.

### 1. Scroll is virtual, not native

`assets/styles/index.css` fixes `html`/`body` and sets `overflow: hidden`. Nothing scrolls natively. All scrollable content must live inside `<ScrollContainer>` (both pages wrap their entire template in it).

`components/ScrollContainer.vue` initializes `@tinokaartovuori/smooth-scrollbar` — a **fork** of smooth-scrollbar that adds the `externalRAF` option. Because of `externalRAF: true`, the scrollbar does not render itself; `ScrollContainer` calls `scrollBar.render()` from a `gsap.ticker` callback. That is deliberate: one GSAP clock drives scroll so scroll position and the WebGL frame can't desync.

Custom scrollbar plugins live in `smooth-scrollbar-plugins/`:

- `speedControl.ts` — clamps/scales wheel delta (registered and in use).

The native scrollbar tracks are removed in `ScrollContainer`; `components/ScrollTrack.vue` draws the visible custom track/indicator from store state via `gsap.ticker`.

### 2. Pinia stores are the bus between DOM and WebGL

- `store/scrollState.ts` — `scrollY`, `scrollYSpeed`, `scrollYMax`. Written only by `ScrollContainer` (both the scrollbar listener and the overscroll plugin callback); read by everything that reacts to scroll (`ThreeScrollCanvas`, `ScrollTrack`, `BottomBar`).
- `store/threeObjectState.ts` — registry of DOM elements that want a 3D counterpart: `threeElementTracker` (element + object-type string) and `threeImageTracker` (image elements). `reset()` clears both; `remove(threeReference)` drops a single entry (used by `ElementTracker`'s unmount hook).

### 3. Registering DOM elements for WebGL

Two wrapper components register into `threeObjectState` on mount:

- `<ElementTracker threeReference="uniqueId" object="IntroRectangle">` — registers its **first slot child** and a string naming which Three class to instantiate.
- `<ThreeImage threeReference="uniqueId" imageUrl="…" alt="…" />` — renders an `opacity-0` `<img>` (it exists only to be measured and to supply the texture URL, but stays in the accessibility tree) and registers it.

The registry is global and keyed by `threeReference`, so **every page must call `threeObjectStateStore.reset()` in its setup** — both existing pages do this.

### 4. The single WebGL host

`components/ThreeScrollCanvas.vue` is mounted once in `layouts/default.vue` inside `<ClientOnly>` and owns everything Three:

- `three-components/Scenario.ts` — scene + perspective camera + renderer. The camera math is the crux of the DOM↔WebGL mapping: with `perspective = 1000` and `fov = 2·atan(height/2/perspective)`, **one world unit equals one CSS pixel** at z=0, so meshes can be positioned directly from `getBoundingClientRect()`.
- `three-components/ImageManager.ts` → builds a `WavyImage` per registered image.
- `three-components/ElementManager.ts` → maps the `object` string to a class (`IntroRectangle`) in a chain of `if` blocks in `loadElements()`. **This is where a new object type gets registered.** It also exports the `TrackedObject3D` interface every element class has to satisfy.

Update flow, all via `watch`:

- `watch(scrollY)` → `imageManager.updateImages(scrollYSpeed)` + `elementManager.updateElementPositions()`
- `watch([width, height])` (from `useWindowSize`, 100ms trailing debounce) → full update + camera/renderer resize
- `watch(threeObjectState)` → tear down and rebuild all meshes (page navigation)
- `onUnmounted` → cancel the rAF, drop every mesh and dispose the renderer

`scenario.render()` runs in its own `requestAnimationFrame` loop, separate from the GSAP ticker that drives the scrollbar.

### 5. Positioning convention for 3D objects

Every object class (`WavyImage`, `IntroRectangle`) repeats the same pattern — copy it when adding new ones:

```ts
const { width, height, top, left } = element.getBoundingClientRect()
sizes.set(width, height)
offset.set(
  left - window.innerWidth / 2 + width / 2, // viewport-center-relative X
  -top + window.innerHeight / 2 - height / 2, // Y, flipped for WebGL
)
```

An element class must extend `Object3D` and expose `update()`, `updatePosition()`, `updateAspectRatio()` and `dispose()` — that is the `TrackedObject3D` interface `ElementManager` types its array with, so a missing method is now a compile error. `ImageManager` is the outlier: it stores `WavyImage[]` and only ever calls `update()` and `dispose()`, which is all `WavyImage` implements.

`WavyImage.ts` holds the signature effect: a `ShaderMaterial` with inline GLSL whose vertex shader bends the plane by smoothed scroll speed (`uScrollSpeed`, lerped by `smoothingFactor`) and by the plane's normalized viewport Y (`uPlaneYPosition`). Shaders are inline template strings, not separate `.glsl` files.

### 6. Theming and assets

- Dark/light via `@nuxtjs/color-mode` with `classSuffix: ''`, matching Tailwind's `darkMode: 'class'`. `ThemeSwitch.vue` writes `useColorMode().preference` and reads the resolved `useColorMode().value` back for the switch position. Custom palette is just two colors: `onyx` (#0c0d12) / `platinum` (#dde0ed); the global 600ms color transition in `index.css` is what makes theme switching feel smooth.
- Google Fonts (Outfit) are **downloaded and inlined as base64** into `assets/fonts/` by `@nuxtjs/google-fonts` (`overwriting: false`). Treat that directory as generated — never hand-edit it, and don't grep it (the base64 blobs will flood results).
- SVGs import as components via `vite-svg-loader`: `import Icon from '../assets/icons/sun.svg?component'`.
- `@` and `~` both alias the project root.

## Known rough edges

- Import gsap as `import { gsap } from 'gsap'`. The default import resolves to the CJS bundle's `module.exports` under Node ESM, where `gsap.timeline` is undefined — every page then 500s during SSR while working fine in the browser.
- `npx prettier --check .` fails on most files: the installed `prettier-plugin-tailwindcss` sorts Tailwind classes differently from the version that originally formatted the repo. Pre-existing drift; it wants a single dedicated `npm run format` commit, landed on its own so it does not bury real diffs.
- No `.gitattributes` and `core.autocrlf=true`, so the working tree is a mix of CRLF and LF. Prettier's default `endOfLine: 'lf'` flags every CRLF file even when the content is already formatted.
- `ThreeImage.vue` registers into `threeObjectState` on mount but never deregisters (`ElementTracker.vue` does). Harmless only because every page calls `reset()` in its setup.
- No `favicon.ico` in `public/`, and no page has an `<h1>` except `error.vue`.
- `layouts/default.vue` has a `TODO: <Preloader />`; `pages/about.vue` is a stub.
- `package.json` still lists the `url` shim as a dependency; nothing imports it since `nuxt.config.ts` switched to `node:url`.
