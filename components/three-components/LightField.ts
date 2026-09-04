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
import type { TrackedObject3D } from './ElementManager'
import type { FrameContext } from './FrameContext'

const config = motion.lightField
type Preset = (typeof config.presets)[keyof typeof config.presets]
const DEFAULT_PRESET: keyof typeof config.presets = 'hero'

/** Upper bound on lights per field; the shader loop is unrolled to this. */
const MAX_LIGHTS = 6

type ThemePair = readonly [light: number, dark: number]

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
  /** The frosted plate itself: a faint tint of the opposite page colour. */
  uBase: { value: Color }
  uBaseAlpha: { value: number }
  /** Peak alpha of one light. */
  uIntensity: { value: number }
  /** Intensity multiplier on the last light, the one under the cursor. */
  uCursorBoost: { value: number }
  /** Vertical elongation from scroll energy, 1 at rest. */
  uStretch: { value: number }
  /** Dither amplitude in 8-bit steps. */
  uGrain: { value: number }
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
  uniform vec3 uBase;
  uniform float uBaseAlpha;
  uniform float uIntensity;
  uniform float uCursorBoost;
  uniform float uStretch;
  uniform float uGrain;
  varying vec2 vUv;

  void main() {
    // Rounded rectangle, as a signed distance in px from the plate's edge
    vec2 p = (vUv - 0.5) * uSize;
    vec2 q = abs(p) - (uSize * 0.5 - uRadius);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
    float mask = 1.0 - smoothstep(-1.0, 1.0, d);

    // Start from the frosted plate and lay each light over it. "Over" rather
    // than additive, so the same field reads on a light and a dark page: the
    // lights tint the plate instead of pushing it toward white.
    vec3 col = uBase;
    float a = uBaseAlpha;
    for (int i = 0; i < MAX_LIGHTS; i++) {
      if (i >= uLightCount) break;
      vec2 dl = (vUv - uLights[i].xy) * uSize;
      dl.y /= uStretch;
      float sigma = uLights[i].z;
      float g = exp(-dot(dl, dl) / (2.0 * sigma * sigma)) * uIntensity;
      if (i == uLightCount - 1) g *= uCursorBoost;
      vec3 c = mix(uColorA, uColorB, uLights[i].w);
      float aOut = g + a * (1.0 - g);
      col = (c * g + col * a * (1.0 - g)) / max(aOut, 1e-4);
      a = aOut;
    }

    // Dither colour and alpha alike: on a dark page the banding lives in the
    // low-alpha tail of each light, not in its colour
    float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    float dither = (n - 0.5) * uGrain / 255.0;
    col += dither;
    a = clamp(a + dither, 0.0, 1.0);

    gl_FragColor = vec4(col, a * mask);

    // Colour uniforms are linear under three's colour management, so the
    // result is encoded here — the same pairing WavyImage relies on
    #include <colorspace_fragment>
  }
`

/**
 * Soft lights drifting behind a frosted plate, pinned to a DOM box.
 *
 * Each light is a gaussian on a slow, deterministic orbit; the last one is
 * pulled to the cursor while the pointer is over the box and eases back to
 * its orbit when it leaves. Scroll energy stretches and brightens the field,
 * and the whole plate trails its box like the images do. The palette is two
 * hues blended per theme, so a switch fades the lights along with the page.
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
  private cursorX = new Spring(config.cursorSpring, 0.5)
  private cursorY = new Spring(config.cursorSpring, 0.5)

  private accent: [Color, Color]
  private cool: [Color, Color]
  private base: [Color, Color]

  constructor(element: HTMLElement, variant?: string) {
    super(new PlaneGeometry(1, 1), new ShaderMaterial())
    this.element = element
    this.preset = resolvePreset(variant)
    this.lag = new Spring(this.preset.lag)

    const { palette } = motion
    this.accent = [new Color(palette.accent[0]), new Color(palette.accent[1])]
    this.cool = [new Color(palette.cool[0]), new Color(palette.cool[1])]
    this.base = [new Color(palette.base[0]), new Color(palette.base[1])]

    this.shaderUniforms = this.buildMaterial()
    this.update()
  }

  private buildMaterial(): LightFieldUniforms {
    const count = Math.min(this.preset.lights, MAX_LIGHTS)
    const lights: Vector4[] = []
    for (let i = 0; i < MAX_LIGHTS; i++) {
      // Alternate the two hues; the cursor light (last) takes the accent
      const mix = i === count - 1 ? 0 : i % 2
      lights.push(new Vector4(0.5, 0.5, 1, mix))
    }

    const uniforms: LightFieldUniforms = {
      uSize: { value: new Vector2(1, 1) },
      uRadius: { value: this.preset.cornerRadius },
      uLights: { value: lights },
      uLightCount: { value: count },
      uColorA: { value: new Color() },
      uColorB: { value: new Color() },
      uBase: { value: new Color() },
      uBaseAlpha: { value: 0 },
      uIntensity: { value: 0 },
      uCursorBoost: { value: 1 },
      uStretch: { value: 1 },
      uGrain: { value: config.grain },
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
    this.offset.set(
      left - window.innerWidth / 2 + width / 2,
      -top + window.innerHeight / 2 - height / 2,
    )
  }

  /** The plate's pixel size, on the mesh and in the shader alike. */
  private applySize() {
    const { inset } = this.preset
    const width = Math.max(1, this.sizes.x - inset * 2)
    const height = Math.max(1, this.sizes.y - inset * 2)
    this.scale.set(width, height, 1)
    this.shaderUniforms.uSize.value.set(width, height)
    // Never wider than the plate is tall, or the SDF folds over itself
    this.shaderUniforms.uRadius.value = Math.min(
      this.preset.cornerRadius,
      Math.min(width, height) / 2,
    )
  }

  /** Full re-measure with the trail at rest. */
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
    u.uBase.value.lerpColors(this.base[0], this.base[1], theme)
    u.uBaseAlpha.value = themed(this.preset.baseAlpha, theme)
  }

  /**
   * Light `i`'s place on its orbit at time `t`, in UV. The phases are
   * derived from the index rather than drawn at random: the scene is rebuilt
   * on every registration, and lights that jumped on each rebuild would give
   * that away.
   */
  private orbit(i: number, t: number, out: Vector2) {
    const { drift } = this.preset
    const count = this.shaderUniforms.uLightCount.value
    const phase = (i / count) * Math.PI * 2
    const speed = drift.speed * (1 + 0.17 * i)
    out.set(
      0.5 +
        0.28 * Math.cos(phase) +
        drift.amplitude * Math.cos(t * speed + phase),
      0.5 +
        0.22 * Math.sin(phase) +
        drift.amplitude * Math.sin(t * speed * 0.73 + phase),
    )
    return out
  }

  updatePosition(ctx: FrameContext) {
    this.measure()
    this.applySize()
    this.applyTheme(ctx.theme)

    const { dt } = ctx
    const { preset } = this
    const u = this.shaderUniforms
    const count = u.uLightCount.value
    const sigma = preset.radius * Math.min(u.uSize.value.x, u.uSize.value.y)

    this.feel.update(ctx.scroll.velocity, dt)
    const { energy } = this.feel

    if (ctx.reduced) {
      // A still field: every light on its orbit at t=0, nothing under the cursor
      this.lag.set(0)
      this.position.set(this.offset.x, this.offset.y, 0)
      for (let i = 0; i < count; i++) {
        const light = u.uLights.value[i]!
        this.orbit(i, 0, orbitScratch)
        light.set(orbitScratch.x, orbitScratch.y, sigma, light.w)
      }
      u.uStretch.value = 1
      u.uCursorBoost.value = 1
      u.uIntensity.value = themed(preset.intensity, ctx.theme)
      return
    }

    // Trail: the plate lags the box in the direction the content is moving
    this.lag.target = -preset.lag.max * this.feel.drive
    this.lag.update(dt)
    this.position.set(this.offset.x, this.offset.y + this.lag.value, 0)

    // Every light but the last drifts on its orbit
    for (let i = 0; i < count - 1; i++) {
      const light = u.uLights.value[i]!
      this.orbit(i, ctx.time, orbitScratch)
      light.set(orbitScratch.x, orbitScratch.y, sigma, light.w)
    }

    // The last light follows the cursor over the plate, and otherwise
    // chases its own orbit — so it re-joins the field on its own when the
    // pointer leaves, from wherever it was
    const { x: width, y: height } = u.uSize.value
    const left = window.innerWidth / 2 + this.position.x - width / 2
    const top = window.innerHeight / 2 - this.position.y - height / 2
    const cursor = cursorUvIn(
      ctx.pointer,
      left,
      top,
      width,
      height,
      cursorScratch,
    )
    const target = cursor ?? this.orbit(count - 1, ctx.time, orbitScratch)
    this.cursorX.target = target.x
    this.cursorY.target = target.y
    this.cursorX.update(dt)
    this.cursorY.update(dt)
    this.hover.target = cursor ? 1 : 0
    this.hover.update(dt)
    const hover = Math.max(0, this.hover.value)
    const cursorLight = u.uLights.value[count - 1]!
    cursorLight.set(
      this.cursorX.value,
      this.cursorY.value,
      sigma,
      cursorLight.w,
    )

    u.uCursorBoost.value = 1 + config.cursorBoost * hover
    u.uStretch.value = 1 + config.stretch * energy
    u.uIntensity.value =
      themed(preset.intensity, ctx.theme) * (1 + config.brighten * energy)
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
