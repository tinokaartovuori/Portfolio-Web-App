import { Color, Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from 'three'
import { Spring } from '~/utils/spring'
import { ScrollFeel } from '~/utils/scrollFeel'
import { cursorUvIn } from '~/utils/cursorUv'
import { motion } from '~/motion.config'
import { PERSPECTIVE } from './Scenario'
import type { TrackedObject3D } from './ElementManager'
import type { FrameContext } from './FrameContext'

const config = motion.glowPlate
type Hue = 'accent' | 'cool'
const DEFAULT_HUE: Hue = 'accent'

type GlowPlateUniforms = {
  /** Already blended for the theme, linear. */
  uColor: { value: Color }
  /** Peak alpha at the centre. */
  uIntensity: { value: number }
  /** width / height of the plate, so the glow is not a stretched ellipse. */
  uAspect: { value: number }
  /** Gaussian sigma in UV units of the plate's height. */
  uSigma: { value: number }
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
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uAspect;
  uniform float uSigma;
  uniform float uGrain;
  varying vec2 vUv;

  void main() {
    // Halfway between a circle and the plate's own ellipse, so the glow
    // reads as a light behind the image rather than a stretched halo
    vec2 d = (vUv - 0.5) * vec2(sqrt(uAspect), 1.0);
    float g = exp(-dot(d, d) / (2.0 * uSigma * uSigma));

    // The gaussian's tail never quite reaches zero, and a plate edge with any
    // alpha left on it reads as a rectangle; fade the outer band to nothing
    vec2 edge = abs(vUv - 0.5);
    float mask = smoothstep(0.5, 0.3, max(edge.x, edge.y));

    float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    float a = clamp(g * mask * uIntensity + (n - 0.5) * uGrain / 255.0, 0.0, 1.0);

    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`

/**
 * A soft light behind an image: a plate a little larger than the element's
 * box, set back in z, drawing one gaussian in the hero's palette. It trails
 * the box through a looser spring than the image does, so the two separate
 * while scrolling and rejoin with a settle, and it brightens under the cursor.
 *
 * `variant` picks the hue: `accent` or `cool`, from `motion.palette`.
 */
export class GlowPlate
  extends Mesh<PlaneGeometry, ShaderMaterial>
  implements TrackedObject3D
{
  element: HTMLElement
  sizes = new Vector2()
  offset = new Vector2()
  shaderUniforms: GlowPlateUniforms

  private feel = new ScrollFeel(motion.scrollFeel)
  private lag = new Spring(config.lag)
  private hover = new Spring(config.hoverSpring)
  private colors: [Color, Color]

  constructor(element: HTMLElement, variant?: string) {
    super(new PlaneGeometry(1, 1), new ShaderMaterial())
    this.element = element

    const hue = resolveHue(variant)
    const pair = motion.palette[hue]
    this.colors = [new Color(pair[0]), new Color(pair[1])]

    this.shaderUniforms = this.buildMaterial()
    this.update()
  }

  private buildMaterial(): GlowPlateUniforms {
    const uniforms: GlowPlateUniforms = {
      uColor: { value: new Color() },
      uIntensity: { value: 0 },
      uAspect: { value: 1 },
      uSigma: { value: config.sigma },
      uGrain: { value: config.grain },
    }
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
    })
    this.material.dispose()
    this.material = material
    return uniforms
  }

  measure() {
    const { width, height, top, left } = this.element.getBoundingClientRect()
    this.sizes.set(width, height)
    this.offset.set(
      left - window.innerWidth / 2 + width / 2,
      -top + window.innerHeight / 2 - height / 2,
    )
  }

  /**
   * Places the plate behind the box. It sits at z = -depth, and a mesh off
   * the z=0 plane has to be scaled and offset by the perspective ratio to
   * keep the screen footprint the box measurement describes.
   */
  private place(trail: number) {
    const { depth, grow } = config
    const k = (PERSPECTIVE + depth) / PERSPECTIVE
    this.position.set(this.offset.x * k, (this.offset.y + trail) * k, -depth)
    this.scale.set(
      Math.max(1, this.sizes.x * grow * k),
      Math.max(1, this.sizes.y * grow * k),
      1,
    )
    this.shaderUniforms.uAspect.value = this.sizes.y
      ? this.sizes.x / this.sizes.y
      : 1
  }

  update() {
    this.measure()
    this.lag.set(0)
    this.feel.reset()
    this.hover.set(0)
    this.place(0)
  }

  updateAspectRatio() {
    this.update()
  }

  updatePosition(ctx: FrameContext) {
    this.measure()
    const { dt, theme } = ctx
    const u = this.shaderUniforms
    u.uColor.value.lerpColors(this.colors[0], this.colors[1], theme)
    const base =
      config.intensity[0] + (config.intensity[1] - config.intensity[0]) * theme

    if (ctx.reduced) {
      this.lag.set(0)
      this.place(0)
      u.uIntensity.value = base
      return
    }

    this.feel.update(ctx.scroll.velocity, dt)
    this.lag.target = -config.lag.max * this.feel.drive
    this.lag.update(dt)
    this.place(this.lag.value)

    // Hover is tested against the DOM box itself: that is where the image is
    const { x: width, y: height } = this.sizes
    const left = window.innerWidth / 2 + this.offset.x - width / 2
    const top = window.innerHeight / 2 - this.offset.y - height / 2
    const over = cursorUvIn(
      ctx.pointer,
      left,
      top,
      width,
      height,
      cursorScratch,
    )
    this.hover.target = over ? 1 : 0
    this.hover.update(dt)
    const hover = Math.max(0, this.hover.value)

    u.uIntensity.value =
      base *
      (1 + config.hoverBoost * hover + config.energyBoost * this.feel.energy)
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }
}

function resolveHue(variant: string | undefined): Hue {
  if (variant === 'accent' || variant === 'cool') return variant
  if (import.meta.dev && variant) {
    console.warn(
      `[GlowPlate] unknown variant "${variant}", using "${DEFAULT_HUE}". Known variants: accent, cool.`,
    )
  }
  return DEFAULT_HUE
}

const cursorScratch = new Vector2()
