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
     * Velocity cap. A violent wheel spin becomes a controlled glide at this
     * speed instead of a jump, and a long Home/End or anchor travel is bounded.
     */
    maxSpeed: 3200,
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
     * restoration, a hash navigation) and must not bounce.
     */
    bounceMaxVelocity: 8000,
  },

  /**
   * How every scroll-driven effect reads the scroll (utils/scrollFeel.ts):
   * the images, the light fields, the glow plates and the marquee all derive
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
   * The colours the decorative meshes draw with, as `[light, dark]` hex pairs
   * blended by the theme. `accent` and `cool` are the two light hues; `base`
   * is the frosted plate tint, the opposite of the page colour so it reads as
   * a faint pane on either.
   */
  palette: {
    accent: [0xbf5f84, 0xe08bab],
    cool: [0x5f6bc4, 0x8b9cf0],
    base: [0x0c0d12, 0xdde0ed],
    /** The page colours themselves (platinum, onyx): what the lit backdrop
     * must look like where no light falls. */
    page: [0xdde0ed, 0x0c0d12],
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
     * The bubble: while scrolling the page bulges like a sphere seen face-on.
     * Vertices near the viewport centre come toward the camera, vertices near
     * the edges go away, each image tilts away from the centre and drifts
     * outward — so where an image sits on screen decides how it moves.
     */
    bubble: {
      /** z travel in world units (≈ px) between the viewport centre and its
       * corners at full energy. */
      depth: 90,
      /** Tilt away from the viewport centre at full energy, radians at the
       * viewport edge. */
      tilt: 0.075,
      /** Outward drift at full energy, px at the viewport edge. */
      spread: 12,
    },
    /** Extra push-back in world units at peak velocity, on top of the bubble. */
    recede: 16,

    /** Idle drift so the images read as floating rather than pasted on. */
    float: { amplitude: 4, speed: 0.55 },

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

    /** Texture overscan so the parallax has room to move without showing edges. */
    zoom: 0.92,
    /** Vertical parallax inside the frame, in UV units per viewport height. */
    parallax: 0.1,

    /**
     * Glitch on a hard scroll: horizontal slices of the image tear sideways
     * once |drive| passes `start`, fully by `full`. Which slices tear, and
     * how far, is re-rolled `rate` times a second.
     */
    glitch: {
      start: 0.35,
      full: 0.75,
      /** Slices across the image's height. */
      slices: 26,
      rate: 10,
      /** Furthest tear, in UV units. */
      shift: 0.09,
      /** Share of slices torn at full glitch. */
      share: 0.5,
    },

    /** Film grain inside the image only: amplitude in colour units, and how
     * many times a second it is re-rolled. */
    grain: { amount: 0.035, rate: 8 },
  },

  /**
   * Frosted-glass light fields (LightField): soft lights drifting behind a
   * rounded plate pinned to a DOM box. The hero and the footer are presets of
   * the same thing.
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
     * Frost: a still per-pixel grain in colour units, shown only where the
     * lights are, so the plate reads as frosted glass rather than a gradient.
     * Also what hides banding in the light tails.
     */
    grain: 0.05,
    presets: {
      hero: {
        /** Lights in the field, at most 6. */
        lights: 5,
        /** Gaussian sigma of one light, as a share of the plate's shorter side. */
        radius: 0.2,
        /**
         * The lights sit evenly on a ring around the plate's centre (radii in
         * UV units) that turns slowly as a whole, and each wobbles around its
         * seat. Even seats keep them from piling up on one another.
         */
        orbit: {
          spin: 0.1,
          ring: [0.32, 0.28],
          wobble: { speed: 0.4, amplitude: 0.07 },
        },
        /** Peak alpha of one light, `[light, dark]` theme. */
        intensity: [0.5, 0.48],
        /** Alpha of the frosted plate itself, `[light, dark]` theme. */
        baseAlpha: [0.02, 0.04],
        /** The plate is drawn this many px inside the element's box. */
        inset: 20,
        cornerRadius: 24,
        /** The plate trails its box a little less than the images do. */
        lag: { max: 14, stiffness: 120, damping: 20 },
      },
      footer: {
        lights: 3,
        radius: 0.36,
        orbit: {
          spin: 0.08,
          ring: [0.34, 0.2],
          wobble: { speed: 0.3, amplitude: 0.06 },
        },
        intensity: [0.45, 0.5],
        baseAlpha: [0.02, 0.04],
        inset: 0,
        cornerRadius: 28,
        lag: { max: 10, stiffness: 120, damping: 20 },
      },
    },
  },

  /**
   * The lit backdrop (Backdrop): a faceted matte surface far behind the page
   * and real point lights beside each image and under the pointer. Unlit,
   * the surface is exactly the page colour; the lights are pale and dim, so
   * what shows is a quiet geometric patch of light near each image.
   */
  backdrop: {
    /** Depth of the surface, world units; the page is at 0, the camera at 1000. */
    depth: -650,
    /** The matte grey the lit shader works with; the ambient light makes
     * unlit areas the page colour whatever this is. Higher takes more light. */
    albedo: 0.35,
    roughness: 1,
    surface: {
      /** Undulation height, world units, and its scale (1 / wavelength). */
      amplitude: 70,
      scale: 0.004,
      /** Vertex spacing, world units: the facet size. */
      cell: 120,
      /** How far vertices are pushed off the grid, as a share of the cell,
       * and how much per-vertex height noise is added, world units. */
      jitter: 0.45,
      roughen: 50,
    },
    /** The surface rides a trail of its own, scaled by depth. */
    lag: { max: 60, stiffness: 90, damping: 18 },
    lights: {
      /** Lights in the pool; the lit shader compiles for this many, so a page
       * with fewer images leaves the rest dark rather than recompiling. */
      pool: 6,
      /** How far the palette hues are pulled toward white for the lights. */
      paleness: 0.6,
      /** Depth of the image lights, and how far past the image's outer edge they sit, px. */
      depth: -220,
      offset: 140,
      /** PointLight intensity (candela; irradiance = intensity / distance²), `[light, dark]` theme. */
      intensity: [340000, 150000],
      /** The lights come on over this share of the viewport height as the hero scrolls away. */
      fadeSpan: 0.6,
      cursor: {
        depth: -200,
        intensity: [220000, 110000],
        spring: { stiffness: 40, damping: 12 },
      },
    },
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

  /**
   * Under `prefers-reduced-motion: reduce` every spring, bend and float is
   * disabled and meshes sit exactly on their DOM boxes; scrolling is native.
   */
} as const

export type MotionConfig = typeof motion
