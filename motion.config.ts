/**
 * Every number that decides how the site *feels* to scroll and touch.
 *
 * The code reads these at runtime, so tuning the feel is a matter of editing
 * this file and watching the dev server reload — no motion code has to change.
 * Units are pixels, seconds and pixels per second unless a comment says
 * otherwise. Spring parameters follow the Framer/react-spring convention
 * (stiffness, damping, mass): a damping of 2·√(stiffness·mass) is critically
 * damped, less than that overshoots, more than that creeps.
 */
export const motion = {
  scroll: {
    /**
     * The scroll position is a critically damped spring chasing the input.
     * A first-order lerp (Lenis' default) restarts its velocity on every wheel
     * notch, which reads as a series of small shoves; a spring keeps velocity
     * continuous, so notches blend into one motion. Stiffness sets how quickly
     * it answers (ω = √stiffness rad/s: 80 reaches 90% of a step in ~0.45s);
     * keep damping at 2·√stiffness so it never overshoots and scrolls back.
     */
    spring: { stiffness: 80, damping: 18 },
    /**
     * Velocity cap, in viewport heights per second. A violent wheel spin
     * becomes a controlled glide at this speed instead of a jump, and a long
     * Home/End or anchor travel is bounded. In screens rather than px so the
     * glide reads the same on every display: a cap in px was three screens a
     * second on a 1080p display and two on a 1440p one, where it dragged.
     * Refreshed every frame from the window's height.
     */
    maxSpeed: 4.5,
    /** Scales wheel deltas before they reach the spring. */
    wheelMultiplier: 1,
    /**
     * Route touch scrolling through Lenis as well. Off by default: native
     * touch scrolling stays on the compositor, which is both smoother and
     * cheaper on battery, and the overscroll spring below still gives touch the
     * bounce. Turn on for identical inertia on every input at the cost of
     * fighting the browser on iOS.
     */
    syncTouch: false,
    /** Inertia strength when `syncTouch` is on (Lenis `touchInertiaExponent`). */
    touchInertiaExponent: 1.7,
    /** Keyboard scrolling is fed to the same spring so it feels the same. */
    keyboard: {
      /** Arrow key step. */
      line: 72,
      /** Page Up/Down and Space step, as a share of the viewport height. */
      page: 0.85,
    },
  },

  /**
   * The rubber band at the top and bottom of the page. The content is pulled
   * past the edge and a spring hauls it back; the WebGL meshes follow because
   * they measure the translated DOM.
   */
  overscroll: {
    /** The content never travels further than this past an edge. */
    max: 240,
    /** Spring that moves the content out and back. Just under critical, so it
     * settles with one small rebound instead of creeping home. */
    stiffness: 120,
    damping: 20,
    /** How much of a wheel delta past the edge becomes displacement. */
    wheelGain: 0.35,
    /**
     * Wheel pull is accumulated and then let go at this rate (per second)
     * once the notches stop, so the band eases home instead of snapping the
     * moment the input ends.
     */
    release: 6,
    /** Same as wheelGain for a finger dragging past the edge. */
    touchGain: 0.9,
    /**
     * Momentum arriving at an edge (a touch flick) is handed to the spring so
     * the page bounces instead of stopping dead. This is the share of the
     * arrival velocity that carries over, and the least velocity worth
     * bouncing for.
     */
    bounceTransfer: 0.4,
    bounceMinVelocity: 500,
    /**
     * Faster than any flick: an arrival above this is a jump (scroll
     * restoration, a hash navigation, a page change) and must not bounce,
     * and a position adopted from outside at this speed leaves no velocity.
     */
    bounceMaxVelocity: 8000,
  },

  /**
   * How every scroll-driven effect reads the scroll (utils/scrollFeel.ts):
   * the images, the light fields, the dust and the marquee all derive
   * their "how fast" from these three numbers, so they agree on it.
   */
  scrollFeel: {
    /**
     * Smoothed scroll velocity drives the directional effects (trail, bend,
     * aberration). The decay rate is per second; 8 settles ~400ms after
     * stopping and blends wheel notches into one swell.
     */
    velocitySmoothing: 8,
    /** Velocity at which scroll effects reach ~76% of their peak. */
    velocityScale: 1800,
    /**
     * "Energy" is the smoothed *magnitude* of scrolling and drives the bubble.
     * Slower than the velocity smoothing so the page swells and relaxes as one
     * motion rather than pulsing with every notch.
     */
    energySmoothing: 5,
  },

  /**
   * The WebGL layer blends its palettes between the light and dark theme by a
   * damped 0..1 value; this decay rate (per second) puts it at 99% in ~0.6s,
   * in step with the CSS colour transition.
   */
  theme: { smoothing: 8 },

  /**
   * How the site comes alive on load, without a preloader. The page paints as
   * a plain document first (text, a CSS plate where each light field will be,
   * the photographs as ordinary `<img>`s); when the WebGL layer is up it is
   * drawn *under* each of those and the DOM version is then hidden or faded,
   * so nothing is ever half-shown over the page colour. Durations in seconds.
   * The envelopes are timed clocks eased with a smoothstep, not `damp`: a
   * fade needs a definite end (a CSS plate to hide, a final `opacity: 0`).
   */
  reveal: {
    /** DOM-side envelope (the scroll track), from the first client frame. */
    page: 0.5,
    /** Scene-wide envelope (the dust), from the frame after the first render. */
    scene: 0.8,
    /** A light field's lights fade in over `duration`, from `grow` smaller. */
    lights: { duration: 0.8, grow: 0.15 },
    /** A photograph: its `<img>` fades out over the finished mesh while the
     * rim, trail, lean and float come in. */
    image: 0.3,
    /** The background portrait fades up to its treatment's own alpha. */
    background: 0.8,
  },

  /**
   * The grain: one surface texture the whole site shares, drawn three times
   * over — over the page behind everything (PageGrain), pinned to the
   * document so it scrolls with it; inside each photograph, pinned to the
   * plane so it rides with the image through its trail and tilt; and over
   * each light field's plate, pinned to the plate. All three hash the same
   * document position, so where they meet the pattern runs on across the
   * seam. A grain is grey mixed over the surface at `alpha` (by theme), one
   * grain per `cell` CSS px (rounded to whole device px of the renderer's
   * capped pixel ratio), in sRGB like a layer over the page would be. On a
   * phone (a coarse pointer) the cell is `cellCoarse` instead: the ratio is
   * capped at 1.5 there and the canvas scaled up to a denser screen, so the
   * desktop's cell came out as a four-physical-pixel block, too big for a
   * screen held that close; half a CSS px rounds to the finest the buffer
   * has. The page and the plates roll at `noise.rate`; the photographs
   * re-roll theirs `rate` times a second: slow, so it lives rather than
   * fizzes; a still grain reads as texture, a fast one as noise.
   */
  grain: {
    rate: 2.5,
    cell: 1.4,
    cellCoarse: 0.5,
    alpha: [0.05, 0.06] as const,
  },

  /**
   * The colours the decorative meshes draw with, as `[light, dark]` hex pairs
   * blended by the theme. `accent` and `cool` are the two light hues; `base`
   * is the text colour, the opposite of the page colour; `plate` is what the
   * light fields' plates are pushed toward — past the page colour, lighter
   * on the light theme and darker on the dark one, so the lights on them
   * have contrast to show against.
   */
  palette: {
    accent: [0xbf5f84, 0xe08bab],
    cool: [0x5f6bc4, 0x8b9cf0],
    base: [0x0c0d12, 0xdde0ed],
    plate: [0xffffff, 0x000000],
  },

  /**
   * The page-wide trail (useTrail): text, rules and shapes lag their scroll
   * position through the same spring the images do, so the page moves as one
   * body. Each site multiplies the trail by its own share.
   */
  trail: {
    text: 1,
    index: 0.9,
    heading: 0.6,
    footer: 0.5,
  },

  /** The WebGL images: how they trail, bend, float and react to the cursor. */
  image: {
    /**
     * The mesh trails the DOM box it is pinned to by up to this many pixels,
     * through a spring just under critical, so it has mass and settles with
     * a small rebound.
     */
    lag: { max: 30, stiffness: 120, damping: 19 },
    /**
     * Share of the trail that becomes extra bend inside the plane. Where the
     * bend lands depends on the plane's place on screen: near the centre of
     * the viewport the whole plane sags, near the edges only its inner side
     * does, so a left-hand image and a right-hand one deform as mirror images.
     */
    bend: 0.6,

    /**
     * The bubble: while scrolling the page curves like a sphere seen face-on,
     * and where an image sits on screen decides how it moves. The sign of
     * all three picks which way: positive bulges toward the viewer (the
     * centre comes forward, the edges go back, images tilt away from the
     * centre and drift outward); negative — the current setting — curves
     * inward like a bowl (the centre sinks back, the edges come forward,
     * images turn toward the centre and draw in).
     */
    bubble: {
      /** z travel in world units (≈ px) between the viewport centre and its
       * corners at full energy. */
      depth: -90,
      /** Tilt at full energy, radians at the viewport edge. */
      tilt: -0.075,
      /** Drift at full energy, px at the viewport edge. */
      spread: -12,
    },
    /** Extra push-back in world units at peak velocity, on top of the bubble. */
    recede: 16,

    /**
     * The lean: on a wide viewport each image turns a little toward the
     * viewport centre, so the two columns face the reader like the wings of
     * a screen. `yaw` is the turn about the vertical axis at the viewport
     * edge, radians, scaled by how far from the centre the image sits;
     * `roll` the same about the depth axis (the top leaning inward), for a
     * flatter, hung-askew look instead. Nothing below `from` px of viewport
     * width, the full angle from `to`.
     */
    lean: { yaw: 0.2, roll: 0, from: 1024, to: 1600 },

    /**
     * Idle drift, in px. Off: at rest a photograph sits exactly on its box
     * (the drift read as the images creeping about on a still page; set an
     * amplitude to have them float).
     */
    float: { amplitude: 0, speed: 0.55 },

    /** Cursor interaction (fine pointers only). */
    hover: {
      /** How quickly the hover state fades in and out. */
      spring: { stiffness: 170, damping: 22 },
      /** Lift toward the camera on hover, in world units. */
      lift: 22,
      /** Tilt toward the cursor, in radians at the image edge. */
      tilt: 0.05,
      tiltSpring: { stiffness: 150, damping: 18 },
      /** The cursor position the shader sees is smoothed by this spring. */
      cursorSpring: { stiffness: 130, damping: 20 },
      /** Radius of the liquid lens under the cursor, in UV units. */
      lensRadius: 0.32,
      /** Bulge height of the lens, in world units. */
      lensBulge: 18,
      /** Magnification inside the lens, as a share of 1. */
      lensZoom: 0.06,
    },

    /** Chromatic aberration in UV units at peak velocity / full hover. */
    aberration: { scroll: 0.006, hover: 0.004 },

    /**
     * A hairline just inside the edge of the photograph in the text colour,
     * `width` px wide at `alpha`: the plane reads as a thing with an edge
     * rather than a picture pasted on. 0 alpha for none.
     */
    rim: { width: 1, alpha: 0.28 },

    /**
     * Texture overscan, as the share of the image the plane shows: 1 is the
     * whole photograph. Below 1 the crop has room to slide inside the frame
     * (`parallax`, in UV units per viewport height, clamped to that room),
     * which is the only thing the overscan buys — the trail, the bend, the
     * bubble and the cursor lens are all geometry and need none. It was 0.92
     * with a parallax of 0.1 and read as an unexplained crop.
     */
    zoom: 1,
    parallax: 0,

    /** Film grain inside the photograph, pinned to the plane: the site's
     * grain (`motion.grain`) at this share of its alpha. */
    grain: { amount: 1 },

    /**
     * Named treatments a ThreeImage can ask for (`variant`). `background`
     * is an image that sits behind the page rather than on it — the
     * portrait under the about text: monochrome (`mono`, 0..1), faded to
     * this share of transparency, dissolved from a rounded shape inside its
     * box outward over this share of its half-width (`edge`), moving at
     * less than the page's speed (`parallax`: the share of its distance
     * from the viewport centre it hangs back by), turned toward the
     * viewport centre `lean` times as far as the other images, and keeping
     * only `motion` of the trail, bend, bubble, float and aberration,
     * `hover` of the cursor lens, `rim` of the hairline and `halation` of
     * the halation (0 for none):
     * scenery that jumps out of the background is noise.
     */
    variants: {
      background: {
        mono: 1,
        fade: 0.74,
        edge: 0.55,
        parallax: 0.12,
        lean: 2,
        motion: 0.25,
        hover: 0,
        rim: 0,
        halation: 0,
        /** The `<img>` stays hidden and the mesh fades in from nothing: the
         * treatment has no DOM equivalent to hand over from. */
        domFirst: false,
      },
    },
  },

  /**
   * Halation (HalationPass, the one post-processing pass): the highlights of
   * the photographs bleed outward in the accent colour, as on film, a little
   * at rest and more on a hard scroll. `threshold` and `knee` are in linear
   * luminance (the render target is linear), and `curve` is the exponent on
   * what is over the threshold: 1 is linear, so the whites bleed several
   * times more than the mid-tones; below 1 the mid-tones come nearer the
   * whites, so the halo sits in the whole photograph rather than on its
   * highlights alone. The halo is drawn at
   * `1 / scale` of the canvas and blurred with a 9-tap gaussian `iterations`
   * times, `radius` buffer px between taps, so its reach in canvas px is
   * about `scale * radius * 4 * iterations`. `rest` is the strength that is
   * always there (0: a still page shows no halo, it is a thing the scroll
   * does); `scroll` is added on top once |drive| passes `start`,
   * fully by `full`, through a damp at `smoothing` (per second) so it swells
   * and fades as one motion. Colour is `palette.accent`, blended by theme.
   *
   * A horizontal-slice glitch and then a frost (a mip-bias defocus) lived in
   * the image shader before this; both were taken out, the first as the wrong
   * era, the second as too little. A soft shadow under the meshes, drawn
   * from the same blur, was tried for depth on the light theme and taken out
   * too: a drop shadow under a photograph is a different site.
   */
  halation: {
    threshold: 0.25,
    knee: 0.2,
    curve: 0.55,
    scale: 4,
    radius: 2.5,
    iterations: 2,
    rest: 0,
    scroll: 1.2,
    start: 0.15,
    full: 0.6,
    smoothing: 5,
  },

  /**
   * Light fields (LightField): soft lights drifting on a frosted plate pinned
   * to a DOM box, the plate a step past the page colour so they stand out.
   * The hero and the footer are presets of the same thing.
   */
  lightField: {
    /**
     * Every light moves through this spring, so the orbit is smooth and the
     * one following the cursor is liquid rather than glued to it.
     */
    spring: { stiffness: 60, damping: 14 },
    /** How quickly the followed light brightens and dims as the pointer
     * enters and leaves the plate. */
    hoverSpring: { stiffness: 120, damping: 20 },
    /** Extra intensity on the light under the pointer. */
    cursorBoost: 0.5,
    /**
     * The lights are not all one size: each is bigger or smaller than the
     * preset's radius by up to `spread` (fixed per light), and breathes by
     * up to `breathe` on its own slow sine at about `speed` rad/s.
     */
    size: { spread: 0.3, breathe: 0.2, speed: 0.3 },
    /**
     * A second, twice as wide gaussian under each light, at this share of
     * the first, `[light, dark]` theme. A light on a pale plate shows only
     * its core — the tail of a plain gaussian is too faint a tint to see on
     * white, where on black the same tail reads as glow — so the light theme
     * gets a broad shoulder to read the same diameter.
     */
    halo: [0.9, 0.2],
    /**
     * A light stays where the pointer left it and carries on from there; it
     * drifts back toward its own seat on the ring at this rate per second —
     * slow enough to read as its own wandering, not a snap back.
     */
    settle: 0.04,
    /** Vertical elongation of every light at full scroll energy, as a share. */
    stretch: 0.6,
    /** Extra intensity at full scroll energy, as a share. */
    brighten: 0.35,
    /**
     * Frost: a grain in colour units in the lit parts only, on top of the
     * surface grain below, for a plate that reads as frosted glass rather
     * than a gradient. Off: with the surface grain over the whole plate the
     * frost on top made the hero far grainier than the page around it.
     */
    grain: 0,
    /** The site's grain (`motion.grain`) over the whole plate, at this share
     * of its alpha: the plate is opaque, so the page's grain stops at its
     * edge and it carries its own, pinned to it. */
    surface: 1,
    presets: {
      hero: {
        /** Lights in the field, at most 6. */
        lights: 5,
        /**
         * Gaussian sigma of one light, as a share of the geometric mean of
         * the plate's sides (so a wide plate gets bigger lights than a tall
         * one of the same height and the empty space stays in proportion),
         * `[light, dark]` theme: a light on a pale plate shows less of its
         * tail, so it is drawn bigger to read the same size.
         */
        radius: [0.14, 0.11],
        /**
         * The lights sit evenly on a ring around the plate's centre (radii in
         * UV units) that turns slowly as a whole, and each wobbles around its
         * seat. Even seats keep them from piling up on one another.
         */
        orbit: {
          spin: 0.16,
          ring: [0.34, 0.3],
          wobble: { speed: 0.55, amplitude: 0.11 },
        },
        /** Peak alpha of one light, `[light, dark]` theme. */
        intensity: [0.8, 0.68],
        /** How far the plate is pushed from the page colour toward
         * `palette.plate`, `[light, dark]` theme. */
        plate: [0.8, 0.6],
        /** The plate is drawn this many px inside the element's box. */
        inset: 20,
        cornerRadius: 24,
        /** The plate trails its box a little less than the images do. */
        lag: { max: 14, stiffness: 120, damping: 20 },
      },
      footer: {
        lights: 3,
        radius: [0.16, 0.13],
        orbit: {
          spin: 0.14,
          ring: [0.36, 0.22],
          wobble: { speed: 0.45, amplitude: 0.1 },
        },
        intensity: [0.75, 0.68],
        plate: [0.8, 0.6],
        inset: 0,
        cornerRadius: 28,
        lag: { max: 10, stiffness: 120, damping: 20 },
      },
    },
  },

  /**
   * The dust (Particles): the page's depth. Layers of particles behind the
   * page, far to near, each moving with the scroll by its own share of the
   * page's speed, so the far ones creep and the near ones nearly keep up —
   * the parallax is what reads as depth. Far particles are tiny and crisp,
   * near ones large and soft, like dust seen past a focused lens. Every one
   * drifts on its own, breathes, and streaks along the scroll when the page
   * moves fast. One colour, the text colour, at a low alpha, with a share of
   * them in the two light hues.
   */
  particles: {
    /**
     * The layers, far to near. `parallax` is the share of the page's scroll
     * the layer moves by (1 would move with the page); `density` is
     * particles per 1000×1000 px of viewport; `size` the diameter range in
     * px; `soft` 0 for a crisp disc, 1 for a gaussian; `alpha` the layer's
     * peak alpha; `drift` how far it wanders, px; `streak` how much of the
     * scroll streak it takes.
     */
    layers: [
      {
        parallax: 0.2,
        density: 110,
        size: [1, 1.8],
        soft: 0.1,
        alpha: 0.5,
        drift: 8,
        streak: 0,
      },
      {
        parallax: 0.45,
        density: 50,
        size: [1.8, 3],
        soft: 0.3,
        alpha: 0.38,
        drift: 14,
        streak: 0.25,
      },
      {
        parallax: 0.75,
        density: 16,
        size: [4, 8],
        soft: 0.75,
        alpha: 0.2,
        drift: 22,
        streak: 0.6,
      },
      {
        parallax: 1,
        density: 4,
        size: [16, 34],
        soft: 1,
        alpha: 0.08,
        drift: 32,
        streak: 1,
      },
    ],
    /** Multiplier on every layer's alpha, `[light, dark]` theme. */
    alpha: [0.9, 1],
    /** Share of the particles drawn in the light hues instead of ink. */
    tint: 0.3,
    /**
     * The wander: each particle's own slow loop, this many rad/s at most,
     * and a rise, px/s, as a share of its layer's drift.
     */
    wander: { speed: 0.35, rise: 0.3 },
    /** Each particle brightens and dims on its own: rate rad/s, depth 0..1. */
    twinkle: { rate: 0.5, depth: 0.5 },
    /**
     * The streak: a particle stretches along the scroll by its speed on
     * screen times this many seconds (a shutter time), up to this many px.
     */
    streak: { exposure: 0.03, max: 90 },
    /** The near layers shift away from the pointer by up to this many px. */
    pointer: { shift: 28, spring: { stiffness: 40, damping: 12 } },
    /** Nothing draws behind the hero; the dust fades in over this many px
     * below its bottom edge. */
    heroFade: 200,
    /** The whole field rides a trail of its own, like the images, scroll px. */
    lag: { max: 40, stiffness: 90, damping: 18 },
  },

  /**
   * The grain over the page (PageGrain): the site's grain (`motion.grain`)
   * drawn behind everything in the scene, pinned to the document so it
   * scrolls with the page, under the text and around the photographs and the
   * plates, which carry their own.
   */
  noise: {
    /**
     * Re-rolled this many times a second — slower than the grain in the
     * photographs, because this one sits under the text, where a lively
     * grain reads as interference. Still under reduced motion.
     */
    rate: 0.6,
    /**
     * The share of the page's scroll the grain moves by: less than 1, so it
     * sits behind the page like the far dust does, the page and the plates
     * a window onto it. The plates' grain moves by the same share, so the
     * pattern runs on across a plate's edge at every scroll position.
     */
    parallax: 0.2,
  },

  /** The fixed bars (Bar.vue). */
  bar: {
    /** Scrolled this many px, the top bar has left the hero: the veil comes
     * on, the bar slides to its compact offset and a phone's stack folds.
     * Nearly at once, so the page reads as scrolled from the first move. */
    scrolledAt: 32,
  },

  /** The scroll prompt in the bottom bar (BottomBar.vue). */
  scrollPrompt: {
    /** Gone once the page has scrolled this many px: it is an invitation,
     * and one already taken up has nothing left to say. */
    hideAfter: 48,
  },

  /** The index row above each project (ProjectIndex.vue). */
  index: {
    /** The rule draws from nothing to full width while the row travels this
     * share of the viewport height up from the bottom edge. */
    drawSpan: 0.35,
    /** Decay rate per second of the draw progress. */
    drawSmoothing: 10,
  },

  /**
   * Wireframe shapes (WireShape): a cube, a pyramid, an octahedron and a
   * globe in the index rows, turning with the scroll and toward the pointer.
   * They sit exactly on their box; the box itself carries the page trail.
   */
  wireShape: {
    /** Shape size as a share of the box's shorter side. */
    fill: 0.75,
    /** Turn at rest, rad/s, and the extra turn at full scroll drive. */
    idleSpin: 0.3,
    scrollSpin: 2.2,
    hoverSpring: { stiffness: 140, damping: 18 },
    /** Growth under the pointer, as a share. */
    lift: 0.18,
    /** Tilt toward the cursor, radians at the box edge. */
    tilt: 0.55,
    tiltSpring: { stiffness: 120, damping: 16 },
    /** Line opacity, `[light, dark]` theme, and the extra under the pointer. */
    opacity: [0.55, 0.5],
    hoverOpacity: 0.35,
  },

  /** The running band of words between the hero and the work (Marquee.vue). */
  marquee: {
    /** Speed on its own, px/s, leftward. */
    baseSpeed: 60,
    /** Share of the smoothed scroll velocity added to it: scrolling down
     * speeds it up, scrolling up slows or reverses it. */
    velocityGain: 0.12,
    /** Speed cap either way, px/s. */
    maxSpeed: 900,
    /** Lean at full scroll drive, degrees of skew. */
    skew: 6,
  },

  /** Magnetic elements (useMagnetic): pulled a little toward a nearby pointer. */
  magnetic: {
    /** How far outside the element's box the pull starts, px. */
    radius: 40,
    /** Share of the pointer's offset from the centre the element moves by. */
    strength: 0.16,
    /** Close to critical: it follows and lets go without a wobble. */
    spring: { stiffness: 170, damping: 24 },
  },

  /** The heart in the top bar (LikeButton.vue). */
  like: {
    /** On press the heart is thrown to this scale and springs back. Under
     * critical damping, so it overshoots a little on the way down. */
    pop: 1.5,
    popSpring: { stiffness: 520, damping: 13 },
    /** The ring the press leaves behind: its size at the end as a multiple
     * of the heart, and the decay rate per second it fades out at. */
    ring: 2.8,
    ringSmoothing: 4.5,
    /** Growth under the pointer, as a share. */
    hoverLift: 0.12,
    hoverSpring: { stiffness: 220, damping: 20 },
  },

  /**
   * Under `prefers-reduced-motion: reduce` every spring, bend and float is
   * disabled and meshes sit exactly on their DOM boxes; scrolling is native.
   */
} as const

export type MotionConfig = typeof motion
