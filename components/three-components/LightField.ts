import {
  Color,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector4,
} from 'three'
import { Spring } from '~/utils/spring'
import { ScrollFeel } from '~/utils/scrollFeel'
import { cursorUvIn } from '~/utils/cursorUv'
import { motion } from '~/motion.config'
import { arrivalFor, advance, type Arrival } from './Arrival'
import type { TrackedObject3D } from './ElementManager'
import type { FrameContext } from './FrameContext'
import { viewport } from './Viewport'
import { grainShader, grainCell } from './grain'

const config = motion.lightField
type Preset = (typeof config.presets)[keyof typeof config.presets]
const DEFAULT_PRESET: keyof typeof config.presets = 'hero'

/** Upper bound on lights per field; the shader loop is unrolled to this. */
const MAX_LIGHTS = 6

type ThemePair = readonly [light: number, dark: number]

/** Deterministic 0..1 per light index; a rebuild must not resize the lights. */
const hash = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** A value that depends on the theme: `[light, dark]`, blended by `theme`. */
const themed = (pair: ThemePair, theme: number) =>
  pair[0] + (pair[1] - pair[0]) * theme

type LightFieldUniforms = {
  /** Plate size in px after the inset — the corner SDF works in pixels. */
  uSize: { value: Vector2 }
  /** Corner radius, px. */
  uRadius: { value: number }
  /** xy: centre in UV, z: sigma in px, w: 0..1 mix from uColorA to uColorB. */
  uLights: { value: Vector4[] }
  uLightCount: { value: number }
  /** Both already blended for the theme, in linear space. */
  uColorA: { value: Color }
  uColorB: { value: Color }
  /** The page colour: the plate is opaque, so nothing behind it shows. */
  uPage: { value: Color }
  /** What the plate is pushed toward from there, and by how much: past the
   * page colour, so the lights have contrast to show against. */
  uPlate: { value: Color }
  uPlateMix: { value: number }
  /** The ±1 level dither in the colour, in colour units: scaled in with the
   * lights so the plate starts flat, the colour the CSS plate over it has. */
  uDither: { value: number }
  /** Peak alpha of one light. */
  uIntensity: { value: number }
  /** Share of a twice-as-wide gaussian under each light. */
  uHalo: { value: number }
  /** Which light is (or was last) under the pointer, -1 for none. */
  uCursorIndex: { value: number }
  /** Intensity multiplier on that light. */
  uCursorBoost: { value: number }
  /** Vertical elongation from scroll energy, 1 at rest. */
  uStretch: { value: number }
  /** The grain: the frost amplitude in the lit parts, the share of grey
   * mixed over the whole plate, one cell in device px, the plate's position
   * in the document in CSS px, the pixel ratio and the roll step — hashed
   * from document positions, the same cells and the same roll as the page
   * grain around the plate, so the two are one texture across its edge. */
  uGrain: { value: number }
  uSurface: { value: number }
  uGrainCell: { value: number }
  uGrainOrigin: { value: Vector2 }
  uGrainRatio: { value: number }
  uRoll: { value: number }
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  #define MAX_LIGHTS ${MAX_LIGHTS}

  uniform vec2 uSize;
  uniform float uRadius;
  uniform vec4 uLights[MAX_LIGHTS];
  uniform int uLightCount;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uPage;
  uniform vec3 uPlate;
  uniform float uPlateMix;
  uniform float uDither;
  uniform float uIntensity;
  uniform float uHalo;
  uniform int uCursorIndex;
  uniform float uCursorBoost;
  uniform float uStretch;
  uniform float uGrain;
  uniform float uSurface;
  uniform float uGrainCell;
  uniform vec2 uGrainOrigin;
  uniform float uGrainRatio;
  uniform float uRoll;
  varying vec2 vUv;

  ${grainShader}

  void main() {
    // Rounded rectangle, as a signed distance in px from the plate's edge
    vec2 p = (vUv - 0.5) * uSize;
    vec2 q = abs(p) - (uSize * 0.5 - uRadius);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
    float mask = 1.0 - smoothstep(-1.0, 1.0, d);

    // Start from an opaque plate pushed a step past the page colour — darker
    // on the dark page, lighter on the light one — and lay each light over
    // that. "Over" rather than additive, so the same field reads on both:
    // the lights tint the plate instead of pushing it toward white. Opaque,
    // so nothing of the dust behind the page shows through the hero.
    vec3 col = mix(uPage, uPlate, uPlateMix);
    // How much of the pixel the lights cover, for the frost below
    float lit = 0.0;
    for (int i = 0; i < MAX_LIGHTS; i++) {
      if (i >= uLightCount) break;
      vec2 dl = (vUv - uLights[i].xy) * uSize;
      dl.y /= uStretch;
      float sigma = uLights[i].z;
      // A gaussian with a broad shoulder: the halo is the same shape twice
      // as wide, normalised so the peak stays at the intensity
      float q = dot(dl, dl) / (2.0 * sigma * sigma);
      float g = (exp(-q) + uHalo * exp(-q * 0.25)) / (1.0 + uHalo) * uIntensity;
      if (i == uCursorIndex) g *= uCursorBoost;
      vec3 c = mix(uColorA, uColorB, uLights[i].w);
      col = mix(col, c, g);
      lit += g * (1.0 - lit);
    }

    // The grain: hashed from where this point of the plate is in the
    // document (the plate's position plus its own UV, so it rides with the
    // plate through its trail), the same cells and the same roll as the
    // page grain around it, so the pattern runs on across the plate's edge
    // and only the colour changes. Frost: the grain in the lit parts, for a
    // plate that reads as frosted glass rather than a gradient. The same
    // noise, faint, in the colour is what hides banding in the light tails.
    vec2 doc = (uGrainOrigin + vec2(vUv.x, 1.0 - vUv.y) * uSize) * uGrainRatio;
    float g = grainAt(doc, uGrainCell, uRoll);
    float n = g - 0.5;
    col += n * uGrain * smoothstep(0.0, 0.25, lit);
    col += n * uDither;

    // The site's grain over the whole plate: the plate is opaque, so the
    // page's grain stops at its edge, and it carries the same grey mix
    // itself
    if (uSurface > 0.0) col = grainOver(col, g, uSurface);

    gl_FragColor = vec4(col, mask);

    // Colour uniforms are linear under three's colour management, so the
    // result is encoded here — the same pairing WavyImage relies on
    #include <colorspace_fragment>
  }
`

/**
 * Soft lights drifting behind a frosted plate, pinned to a DOM box.
 *
 * The lights sit evenly on a ring that turns slowly as a whole, each
 * wobbling around its seat, and every one moves through a spring. While the
 * pointer is over the plate the nearest light follows it; when the pointer
 * leaves, that light stays where it was dropped and carries on wobbling from
 * there, easing back toward its seat over the next minute or so. Scroll
 * energy stretches and brightens the field, and the whole plate trails its
 * box like the images do. The palette is two hues blended per theme, so a
 * switch fades the lights along with the page.
 *
 * `variant` names a preset in `motion.lightField.presets`: the hero and the
 * footer are the same class with different counts, sizes and insets.
 */
export class LightField
  extends Mesh<PlaneGeometry, ShaderMaterial>
  implements TrackedObject3D
{
  element: HTMLElement
  preset: Preset

  sizes = new Vector2()
  offset = new Vector2()
  shaderUniforms: LightFieldUniforms

  private feel = new ScrollFeel(motion.scrollFeel)
  /** Vertical trail behind the DOM box, px. */
  private lag: Spring
  private hover = new Spring(config.hoverSpring)

  /** Each light's drawn position, in UV, through a spring. */
  private lightX: Spring[] = []
  private lightY: Spring[] = []
  /** Where each light was left relative to its seat, in UV. */
  private offsets: Vector2[] = []
  /** The box's viewport position at the last measure, for the grain. */
  private left = 0
  private top = 0
  /** The light following the pointer, -1 for none. */
  private follower = -1

  /**
   * The CSS plate the page paints in this box (`[data-plate]`, see
   * utils/plate.ts): hidden once this mesh has been drawn under it in the
   * same colour, so the visitor never sees the swap. Restored by the canvas
   * when the scene goes away, not here: this mesh is rebuilt often.
   */
  private plateElement: HTMLElement | null
  /** The arrival clock the lights fade in on; on the element, so a rebuild
   * does not replay it. */
  private arrival: Arrival

  private accent: [Color, Color]
  private cool: [Color, Color]
  private base: [Color, Color]
  private plate: [Color, Color]

  constructor(element: HTMLElement, variant?: string) {
    super(new PlaneGeometry(1, 1), new ShaderMaterial())
    this.element = element
    this.preset = resolvePreset(variant)
    this.plateElement = element.querySelector<HTMLElement>('[data-plate]')
    this.arrival = arrivalFor(element)
    this.lag = new Spring(this.preset.lag)

    const { palette } = motion
    this.accent = [new Color(palette.accent[0]), new Color(palette.accent[1])]
    this.cool = [new Color(palette.cool[0]), new Color(palette.cool[1])]
    this.base = [new Color(palette.base[0]), new Color(palette.base[1])]
    this.plate = [new Color(palette.plate[0]), new Color(palette.plate[1])]

    this.shaderUniforms = this.buildMaterial()

    const count = this.shaderUniforms.uLightCount.value
    for (let i = 0; i < count; i++) {
      this.seat(i, 0, orbitScratch)
      this.lightX.push(new Spring(config.spring, orbitScratch.x))
      this.lightY.push(new Spring(config.spring, orbitScratch.y))
      this.offsets.push(new Vector2())
    }

    this.update()
  }

  private buildMaterial(): LightFieldUniforms {
    const count = Math.min(this.preset.lights, MAX_LIGHTS)
    const lights: Vector4[] = []
    for (let i = 0; i < MAX_LIGHTS; i++) {
      // The two hues alternate around the ring
      lights.push(new Vector4(0.5, 0.5, 1, i % 2))
    }

    const uniforms: LightFieldUniforms = {
      uSize: { value: new Vector2(1, 1) },
      uRadius: { value: this.preset.cornerRadius },
      uLights: { value: lights },
      uLightCount: { value: count },
      uColorA: { value: new Color() },
      uColorB: { value: new Color() },
      uPage: { value: new Color() },
      uPlate: { value: new Color() },
      uPlateMix: { value: 0 },
      uDither: { value: 0 },
      uIntensity: { value: 0 },
      uHalo: { value: 0 },
      uCursorIndex: { value: -1 },
      uCursorBoost: { value: 1 },
      uStretch: { value: 1 },
      uGrain: { value: config.grain },
      uSurface: { value: 0 },
      uGrainCell: { value: 1 },
      uGrainOrigin: { value: new Vector2() },
      uGrainRatio: { value: 1 },
      uRoll: { value: 0 },
    }

    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
    })

    // The placeholder handed to super() only existed to satisfy the base
    this.material.dispose()
    this.material = material
    return uniforms
  }

  /** Reads the box: size, and its centre relative to the viewport centre. */
  measure() {
    const { width, height, top, left } = this.element.getBoundingClientRect()
    this.sizes.set(width, height)
    this.left = left
    this.top = top
    this.offset.set(
      left - viewport.width / 2 + width / 2,
      -(top - viewport.top) + viewport.height / 2 - height / 2,
    )
  }

  /** The plate's pixel size, on the mesh and in the shader alike. */
  private applySize() {
    const { inset } = this.preset
    const width = Math.max(1, this.sizes.x - inset * 2)
    const height = Math.max(1, this.sizes.y - inset * 2)
    this.scale.set(width, height, 1)
    this.shaderUniforms.uSize.value.set(width, height)
    this.shaderUniforms.uGrainCell.value = grainCell(viewport.ratio)
    this.shaderUniforms.uGrainRatio.value = viewport.ratio
    // Never wider than the plate is tall, or the SDF folds over itself
    this.shaderUniforms.uRadius.value = Math.min(
      this.preset.cornerRadius,
      Math.min(width, height) / 2,
    )
  }

  /**
   * Where the plate's top-left corner is in the page grain's space (see
   * PageGrain): its viewport position plus the parallax share of the scroll
   * as seen. From the plane as drawn, not the box, so that while the plate
   * trails its box the grain stays put on screen like the page's and the
   * plate slides over it as a window.
   */
  private applyGrainOrigin(left: number, top: number, ctx: FrameContext) {
    const seen = ctx.scroll.y - ctx.scroll.overscroll
    this.shaderUniforms.uGrainOrigin.value.set(
      left,
      top + seen * motion.noise.parallax,
    )
  }

  /** Full re-measure with the trail at rest; the lights keep their places. */
  update() {
    this.measure()
    this.applySize()
    this.lag.set(0)
    this.feel.reset()
    this.position.set(this.offset.x, this.offset.y, 0)
  }

  updateAspectRatio() {
    this.update()
  }

  private applyTheme(theme: number) {
    const u = this.shaderUniforms
    u.uColorA.value.lerpColors(this.accent[0], this.accent[1], theme)
    u.uColorB.value.lerpColors(this.cool[0], this.cool[1], theme)
    // The page colour is the text colour of the other theme
    u.uPage.value.lerpColors(this.base[1], this.base[0], theme)
    u.uPlate.value.lerpColors(this.plate[0], this.plate[1], theme)
    u.uPlateMix.value = themed(this.preset.plate, theme)
    u.uHalo.value = themed(config.halo, theme)
  }

  /**
   * Light `i`'s seat at time `t`, in UV: its place on the turning ring plus
   * its own wobble. Phases come from the index rather than from random
   * numbers: the scene is rebuilt on every registration, and lights that
   * jumped on each rebuild would give that away.
   */
  private seat(i: number, t: number, out: Vector2) {
    const { orbit } = this.preset
    const count = this.shaderUniforms.uLightCount.value
    const angle = (i / count) * Math.PI * 2 + t * orbit.spin
    const { wobble } = orbit
    const speed = wobble.speed * (1 + 0.2 * i)
    out.set(
      0.5 +
        orbit.ring[0] * Math.cos(angle) +
        wobble.amplitude * Math.cos(t * speed + i * 2.1),
      0.5 +
        orbit.ring[1] * Math.sin(angle) +
        wobble.amplitude * Math.sin(t * speed * 0.8 + i * 1.7),
    )
    return out
  }

  /** The light drawn nearest the pointer, measured in plate px. */
  private nearest(cursor: Vector2) {
    const { x: width, y: height } = this.shaderUniforms.uSize.value
    let best = 0
    let bestDistance = Infinity
    for (let i = 0; i < this.lightX.length; i++) {
      const dx = (this.lightX[i]!.value - cursor.x) * width
      const dy = (this.lightY[i]!.value - cursor.y) * height
      const distance = dx * dx + dy * dy
      if (distance < bestDistance) {
        bestDistance = distance
        best = i
      }
    }
    return best
  }

  updatePosition(ctx: FrameContext) {
    this.measure()
    this.applySize()
    this.applyTheme(ctx.theme)
    // The grain rolls with the page grain's clock; still under reduced motion
    this.shaderUniforms.uRoll.value = ctx.reduced
      ? 0
      : Math.floor(ctx.time * motion.noise.rate)

    const { dt } = ctx
    const { preset } = this
    const u = this.shaderUniforms
    const count = u.uLightCount.value

    /*
     * The arrival. Until the scene has drawn a frame the plate is flat: no
     * lights, no dither, no trail — the colour the CSS plate over it has, so
     * the first drawn frame changes nothing on screen. Once drawn, the CSS
     * plate is hidden (visibility is not transitioned, so this is the same
     * frame) and the lights come up over `motion.reveal.lights.duration`,
     * from `grow` smaller, on this element's own clock.
     */
    if (ctx.rendered && this.plateElement?.style.visibility !== 'hidden') {
      if (this.plateElement) this.plateElement.style.visibility = 'hidden'
    }
    const { lights } = motion.reveal
    const e =
      this.arrival.t >= 1
        ? 1
        : ctx.rendered
          ? advance(this.arrival, dt, lights.duration, ctx.reduced)
          : 0
    // The surface grain comes in with the lights too, so the plate is flat
    // under the CSS plate until the handover. It hides the banding in the
    // light tails on its own; the dither is only for a plate without it,
    // since on top of it the two add up and the plate reads grainier than
    // the page around it
    const { alpha } = motion.grain
    u.uSurface.value =
      (alpha[0] + (alpha[1] - alpha[0]) * ctx.theme) * config.surface * e
    u.uDither.value = config.surface > 0 ? 0 : (2 / 255) * e

    // The base size follows the geometric mean of the plate's sides, so the
    // empty space around the lights stays in proportion on a wide plate and
    // a tall one alike; each light then has its own size and its own breath
    const base =
      themed(preset.radius, ctx.theme) *
      Math.sqrt(u.uSize.value.x * u.uSize.value.y) *
      (1 - lights.grow * (1 - e))
    const sigmaOf = (i: number, t: number) => {
      const { spread, breathe, speed } = config.size
      const own = 1 + spread * (hash(i) - 0.5) * 2
      const breath =
        1 + breathe * Math.sin(t * speed * (0.8 + 0.15 * i) + i * 2.3)
      return base * own * breath
    }

    this.feel.update(ctx.scroll.velocity, dt)
    const { energy } = this.feel

    if (ctx.reduced) {
      // A still field: every light on its seat at t=0, nothing under the cursor
      this.lag.set(0)
      this.position.set(this.offset.x, this.offset.y, 0)
      for (let i = 0; i < count; i++) {
        this.seat(i, 0, orbitScratch)
        this.lightX[i]!.set(orbitScratch.x)
        this.lightY[i]!.set(orbitScratch.y)
        this.offsets[i]!.set(0, 0)
        u.uLights.value[i]!.set(
          orbitScratch.x,
          orbitScratch.y,
          sigmaOf(i, 0),
          i % 2,
        )
      }
      this.follower = -1
      u.uCursorIndex.value = -1
      u.uCursorBoost.value = 1
      u.uStretch.value = 1
      u.uIntensity.value = themed(preset.intensity, ctx.theme) * e
      // On its box
      const { inset } = preset
      this.applyGrainOrigin(this.left + inset, this.top + inset, ctx)
      return
    }

    // Trail: the plate lags the box in the direction the content is moving
    this.lag.target = -preset.lag.max * this.feel.drive * e
    this.lag.update(dt)
    this.position.set(this.offset.x, this.offset.y + this.lag.value, 0)

    // The pointer takes the nearest light when it arrives; when it leaves,
    // the light is left where it is — its displacement from its seat becomes
    // an offset it carries on from — so nothing snaps back
    const { x: width, y: height } = u.uSize.value
    const left = viewport.width / 2 + this.position.x - width / 2
    const top =
      viewport.height / 2 - this.position.y - height / 2 + viewport.top
    this.applyGrainOrigin(left, top, ctx)
    const cursor = cursorUvIn(
      ctx.pointer,
      left,
      top,
      width,
      height,
      cursorScratch,
    )
    if (cursor) {
      if (this.follower < 0) this.follower = this.nearest(cursor)
      u.uCursorIndex.value = this.follower
    } else if (this.follower >= 0) {
      const i = this.follower
      this.seat(i, ctx.time, orbitScratch)
      this.offsets[i]!.set(
        this.lightX[i]!.value - orbitScratch.x,
        this.lightY[i]!.value - orbitScratch.y,
      )
      this.follower = -1
    }

    const relax = Math.exp(-config.settle * dt)
    for (let i = 0; i < count; i++) {
      const x = this.lightX[i]!
      const y = this.lightY[i]!
      if (i === this.follower && cursor) {
        x.target = cursor.x
        y.target = cursor.y
      } else {
        const offset = this.offsets[i]!
        offset.multiplyScalar(relax)
        this.seat(i, ctx.time, orbitScratch)
        x.target = orbitScratch.x + offset.x
        y.target = orbitScratch.y + offset.y
      }
      x.update(dt)
      y.update(dt)
      u.uLights.value[i]!.set(x.value, y.value, sigmaOf(i, ctx.time), i % 2)
    }

    this.hover.target = cursor ? 1 : 0
    this.hover.update(dt)
    const hover = Math.max(0, this.hover.value)

    u.uCursorBoost.value = 1 + config.cursorBoost * hover
    u.uStretch.value = 1 + config.stretch * energy * e
    u.uIntensity.value =
      themed(preset.intensity, ctx.theme) * (1 + config.brighten * energy) * e
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }
}

function resolvePreset(variant: string | undefined): Preset {
  const presets: Record<string, Preset | undefined> = config.presets
  const preset = variant ? presets[variant] : undefined
  if (preset) return preset

  if (import.meta.dev && variant) {
    console.warn(
      `[LightField] unknown variant "${variant}", using "${DEFAULT_PRESET}". Known variants: ${Object.keys(
        config.presets,
      ).join(', ')}.`,
    )
  }
  return config.presets[DEFAULT_PRESET]
}

// Scratch vectors, so the per-frame update allocates nothing
const orbitScratch = new Vector2()
const cursorScratch = new Vector2()
