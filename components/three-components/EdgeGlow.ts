import { Color, Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from 'three'
import { Spring } from '~/utils/spring'
import { ScrollFeel } from '~/utils/scrollFeel'
import { cursorUvIn } from '~/utils/cursorUv'
import { motion } from '~/motion.config'
import { PERSPECTIVE } from './Scenario'
import type { TrackedObject3D } from './ElementManager'
import type { FrameContext } from './FrameContext'

const config = motion.edgeGlow
type Hue = 'accent' | 'cool'
type Side = 'left' | 'right'

type EdgeGlowUniforms = {
  /** Already blended for the theme, linear. */
  uColor: { value: Color }
  /** Peak alpha, at the page edge. */
  uIntensity: { value: number }
  /** Which end of the plate is the page edge: 0 for u=0, 1 for u=1. */
  uEdge: { value: number }
  uReach: { value: number }
  uSpreadY: { value: number }
  uNoiseScale: { value: Vector2 }
  uNoiseSpeed: { value: number }
  uNoiseContrast: { value: number }
  uTime: { value: number }
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
  uniform float uEdge;
  uniform float uReach;
  uniform float uSpreadY;
  uniform vec2 uNoiseScale;
  uniform float uNoiseSpeed;
  uniform float uNoiseContrast;
  uniform float uTime;
  uniform float uGrain;
  varying vec2 vUv;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
      mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * vnoise(p);
      p = p * 2.03 + 17.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Distance from the page edge, 0..1 across the plate
    float d = uEdge < 0.5 ? vUv.x : 1.0 - vUv.x;
    float h = exp(-d * d / (2.0 * uReach * uReach));
    float y = (vUv.y - 0.5) * 2.0;
    float v = exp(-y * y / (2.0 * uSpreadY * uSpreadY));

    // The irregularity: a slow field of noise that thickens and thins the
    // wash, so its edge is organic rather than geometric
    vec2 np = vec2(vUv.x * uNoiseScale.x, vUv.y * uNoiseScale.y)
      + vec2(uTime * uNoiseSpeed, -uTime * uNoiseSpeed * 0.6);
    float n = fbm(np);
    float irregular = mix(1.0 - uNoiseContrast, 1.0 + uNoiseContrast, n);

    // The plate's own borders must never show — apart from the one at the
    // page edge, which is off screen
    float mask = smoothstep(0.5, 0.36, abs(vUv.y - 0.5)) * smoothstep(1.0, 0.72, d);

    float a = h * v * irregular * mask * uIntensity;
    a = clamp(a + (hash12(gl_FragCoord.xy) - 0.5) * uGrain / 255.0, 0.0, 1.0);

    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`

/**
 * Light spilling in from the page's edge at a project image: a plate that
 * runs from just outside the viewport edge to a little past the image's inner
 * edge, set back in z behind the image, drawing a wash that fades away from
 * the edge and is thickened and thinned by slow noise. It trails the box
 * through the image's own spring, so the two move as one, and brightens
 * under the pointer.
 *
 * `variant` is `<hue>-<side>`: `accent` or `cool`, `left` or `right`.
 */
export class EdgeGlow
  extends Mesh<PlaneGeometry, ShaderMaterial>
  implements TrackedObject3D
{
  element: HTMLElement
  sizes = new Vector2()
  offset = new Vector2()
  shaderUniforms: EdgeGlowUniforms
  side: Side

  private feel = new ScrollFeel(motion.scrollFeel)
  private lag = new Spring(config.lag)
  private hover = new Spring(config.hoverSpring)
  private colors: [Color, Color]

  constructor(element: HTMLElement, variant?: string) {
    super(new PlaneGeometry(1, 1), new ShaderMaterial())
    this.element = element

    const { hue, side } = resolveVariant(variant)
    this.side = side
    const pair = motion.palette[hue]
    this.colors = [new Color(pair[0]), new Color(pair[1])]

    this.shaderUniforms = this.buildMaterial()
    this.update()
  }

  private buildMaterial(): EdgeGlowUniforms {
    const { noise } = config
    const uniforms: EdgeGlowUniforms = {
      uColor: { value: new Color() },
      uIntensity: { value: 0 },
      uEdge: { value: this.side === 'left' ? 0 : 1 },
      uReach: { value: config.reach },
      uSpreadY: { value: config.spreadY },
      uNoiseScale: { value: new Vector2(noise.scale[0], noise.scale[1]) },
      uNoiseSpeed: { value: noise.speed },
      uNoiseContrast: { value: noise.contrast },
      uTime: { value: 0 },
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
   * Places the plate between the page edge and the image. It sits at
   * z = -depth, so position and size are scaled by the perspective ratio to
   * keep the screen footprint the measurements describe.
   */
  private place(trail: number) {
    const { depth, overhang, bleed, grow } = config
    const k = (PERSPECTIVE + depth) / PERSPECTIVE
    const viewport = window.innerWidth
    const imageLeft = viewport / 2 + this.offset.x - this.sizes.x / 2
    const imageRight = viewport / 2 + this.offset.x + this.sizes.x / 2

    const left = this.side === 'left' ? -overhang : imageLeft - bleed
    const right =
      this.side === 'left' ? imageRight + bleed : viewport + overhang
    const width = Math.max(1, right - left)
    const height = Math.max(1, this.sizes.y * grow)
    const centerX = (left + right) / 2 - viewport / 2

    this.position.set(centerX * k, (this.offset.y + trail) * k, -depth)
    this.scale.set(width * k, height * k, 1)
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
      u.uTime.value = 0
      return
    }

    this.feel.update(ctx.scroll.velocity, dt)
    this.lag.target = -config.lag.max * this.feel.drive
    this.lag.update(dt)
    this.place(this.lag.value)
    u.uTime.value = ctx.time

    // Hover is tested against the image's box, where the image is
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

function resolveVariant(variant: string | undefined): {
  hue: Hue
  side: Side
} {
  const [hueName = 'accent', sideName = 'left'] = (variant ?? '').split('-')
  const hue: Hue = hueName === 'cool' ? 'cool' : 'accent'
  const side: Side = sideName === 'right' ? 'right' : 'left'
  if (import.meta.dev && variant && (hue !== hueName || side !== sideName)) {
    console.warn(
      `[EdgeGlow] unknown variant "${variant}", using "${hue}-${side}". Known variants: accent-left, accent-right, cool-left, cool-right.`,
    )
  }
  return { hue, side }
}

const cursorScratch = new Vector2()
