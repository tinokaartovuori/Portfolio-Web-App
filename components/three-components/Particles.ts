import {
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
} from 'three'
import { Spring } from '~/utils/spring'
import { ScrollFeel } from '~/utils/scrollFeel'
import { motion } from '~/motion.config'
import { ease } from '~/composables/useReveal'
import { PERSPECTIVE } from './Scenario'
import type { FrameContext } from './FrameContext'
import { viewport } from './Viewport'

const config = motion.particles

/**
 * How far behind the page the field sits, world units. Far enough that an
 * image receding on a hard scroll (bubble depth plus recede, ~110) can never
 * pass behind it and show the dust through the photograph; the footprint is
 * scaled by the perspective so the px maths below still hold.
 */
const DEPTH = 200

/** Deterministic 0..1 per (index, salt); a rebuild must not reshuffle the dust. */
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Blends two hex colours in sRGB, as the CSS transition does, so the canvas
 * and the page agree on every in-between shade of a theme switch.
 */
const lerpSrgb = (out: Color, a: number, b: number, t: number) => {
  const c = (h: number, s: number) => ((h >> s) & 255) / 255
  out.setRGB(
    lerp(c(a, 16), c(b, 16), t),
    lerp(c(a, 8), c(b, 8), t),
    lerp(c(a, 0), c(b, 0), t),
    SRGBColorSpace,
  )
}

type ParticleUniforms = {
  /** The field the dust wraps in, px: the viewport plus a margin. */
  uField: { value: Vector2 }
  /** Scroll as seen (with the band) plus the trail, px. */
  uScroll: { value: number }
  uTime: { value: number }
  /** The pointer's shift of the nearest layer, px. */
  uPointer: { value: Vector2 }
  /** Smoothed scroll velocity, px/s; what the streaks are made of. */
  uVelocity: { value: number }
  uExposure: { value: number }
  uStreakMax: { value: number }
  uWander: { value: number }
  uRise: { value: number }
  uTwinkleRate: { value: number }
  uTwinkleDepth: { value: number }
  /** The hero's bottom edge in world y; nothing draws above it. */
  uCut: { value: number }
  uFade: { value: number }
  /** 0 under reduced motion: nothing of its own moves. */
  uMotion: { value: number }
  uDepthScale: { value: number }
  uInk: { value: Color }
  uAccent: { value: Color }
  uCool: { value: Color }
  uAlpha: { value: number }
}

const vertexShader = /* glsl */ `
  // Where in the field, 0..1
  attribute vec2 aSeed;
  // parallax, diameter px, softness 0..1, alpha
  attribute vec4 aLook;
  // drift px, streak share, tint (0 ink, 1 accent, 2 cool), phase 0..1
  attribute vec4 aMove;

  uniform vec2 uField;
  uniform float uScroll;
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uVelocity;
  uniform float uExposure;
  uniform float uStreakMax;
  uniform float uWander;
  uniform float uRise;
  uniform float uTwinkleRate;
  uniform float uTwinkleDepth;
  uniform float uCut;
  uniform float uFade;
  uniform float uMotion;
  uniform float uDepthScale;
  uniform vec3 uInk;
  uniform vec3 uAccent;
  uniform vec3 uCool;
  uniform float uAlpha;

  varying vec2 vLocal;
  varying float vSize;
  varying float vExt;
  varying float vSoft;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float parallax = aLook.x;
    float size = aLook.y;
    float phase = aMove.w * 6.2831853;
    float t = uTime * uMotion;

    // Each particle's own slow loop, plus a rise, like dust in still air
    float w = t * uWander;
    vec2 drift = aMove.x * vec2(
      sin(w + phase) + 0.5 * sin(w * 2.3 + phase * 1.7),
      cos(w * 0.8 + phase * 1.3) + 0.5 * sin(w * 1.9 + phase * 0.6)
    );
    drift.y += aMove.x * uRise * t;

    // The layer moves with the page by its share, and away from the
    // pointer by it; the field wraps, so nothing ever runs out
    vec2 p = aSeed * uField + drift;
    p.y += uScroll * parallax;
    p -= uPointer * parallax;
    p = mod(p, uField) - uField * 0.5;

    // The streak: the particle stretches along the scroll by its speed on
    // screen over a shutter time. The quad grows to hold it, and the
    // gaussian's tail
    float ext = min(aMove.y * abs(uVelocity) * parallax * uExposure, uStreakMax);
    float radius = size * 0.5;
    float reach = max(radius * (1.0 + aLook.z), 1.5);
    vec2 local = position.xy * 2.0 * vec2(reach, reach + ext * 0.5);

    vLocal = local;
    vSize = size;
    vExt = ext;
    vSoft = aLook.z;

    // Breathing, the cut below the hero, and a streak spreads its ink thin
    float twinkle = 1.0 - uTwinkleDepth *
      (0.5 + 0.5 * sin(t * uTwinkleRate * (0.6 + aMove.w) + phase * 3.0));
    float cut = smoothstep(0.0, 1.0, (uCut - p.y) / uFade);
    float thin = radius / (radius + ext * 0.35);
    vAlpha = aLook.w * uAlpha * twinkle * cut * thin;
    vColor = aMove.z < 0.5 ? uInk : (aMove.z < 1.5 ? uAccent : uCool);

    vec2 xy = (p + local) * uDepthScale;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(xy, 0.0, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying vec2 vLocal;
  varying float vSize;
  varying float vExt;
  varying float vSoft;
  varying float vAlpha;
  varying vec3 vColor;

  // Per-pixel hash without a sine, which shows its period on some GPUs
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    // A capsule: a disc, or a streak with round ends
    vec2 q = vec2(vLocal.x, max(abs(vLocal.y) - vExt * 0.5, 0.0));
    float r = length(q);
    float radius = vSize * 0.5;

    // Crisp: an antialiased edge. Soft: a gaussian, sigma at half the
    // radius, so the tail dies inside the quad
    float hard = 1.0 - smoothstep(radius - 0.7, radius + 0.7, r);
    float sigma = max(radius * 0.5, 0.35);
    float gauss = exp(-r * r / (2.0 * sigma * sigma));
    float a = mix(hard, gauss, vSoft) * vAlpha;

    // Dithered: the soft ones are all low-alpha tail, where banding lives
    a += (hash12(gl_FragCoord.xy) - 0.5) * (2.0 / 255.0);

    gl_FragColor = vec4(vColor, clamp(a, 0.0, 1.0));

    // Colour uniforms are linear under three's colour management, so the
    // result is encoded here — the same pairing WavyImage relies on
    #include <colorspace_fragment>
  }
`

/**
 * The dust behind the page: layers of particles, far to near, each moving
 * with the scroll by its own share of the page's speed. The far ones are
 * tiny, crisp and slow, the near ones large, soft and nearly keeping up with
 * the page — which is what reads as depth. Every particle drifts on its own
 * loop, breathes, and streaks along the scroll when the page moves fast; the
 * near layers shift away from the pointer; the whole field rides a trail of
 * its own, like the images.
 *
 * One instanced quad per particle, the whole of it computed in the vertex
 * shader from index-derived seeds, so a rebuild changes nothing and the CPU
 * touches a dozen uniforms a frame. Everything is in viewport px on a plane
 * behind the page, scaled by the perspective to keep the px footprint, so
 * an image receding on a hard scroll never passes behind it. Nothing draws
 * above the hero's bottom edge. Under reduced motion it still follows the
 * scroll but nothing of its own moves.
 */
export default class Particles {
  private scene: Scene
  private mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>
  private uniforms: ParticleUniforms

  private feel = new ScrollFeel(motion.scrollFeel)
  private lag = new Spring(config.lag)
  private pointerX = new Spring(config.pointer.spring)
  private pointerY = new Spring(config.pointer.spring)

  private ink: [number, number]
  private accent: [number, number]
  private cool: [number, number]

  constructor(scene: Scene) {
    this.scene = scene
    const { palette } = motion
    this.ink = [palette.base[0], palette.base[1]]
    this.accent = [palette.accent[0], palette.accent[1]]
    this.cool = [palette.cool[0], palette.cool[1]]

    const depthScale = (PERSPECTIVE + DEPTH) / PERSPECTIVE
    this.uniforms = {
      uField: { value: new Vector2(1, 1) },
      uScroll: { value: 0 },
      uTime: { value: 0 },
      uPointer: { value: new Vector2() },
      uVelocity: { value: 0 },
      uExposure: { value: config.streak.exposure },
      uStreakMax: { value: config.streak.max },
      uWander: { value: config.wander.speed },
      uRise: { value: config.wander.rise },
      uTwinkleRate: { value: config.twinkle.rate },
      uTwinkleDepth: { value: config.twinkle.depth },
      uCut: { value: -1e9 },
      uFade: { value: config.heroFade },
      uMotion: { value: 1 },
      uDepthScale: { value: depthScale },
      uInk: { value: new Color() },
      uAccent: { value: new Color() },
      uCool: { value: new Color() },
      uAlpha: { value: 1 },
    }

    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
    })

    this.mesh = new Mesh(this.build(), material)
    // Positions come out of the shader, so three cannot cull it
    this.mesh.frustumCulled = false
    // Behind the page; first of the transparent draws, so the plates cover it
    this.mesh.position.z = -DEPTH
    this.mesh.renderOrder = -1
    scene.add(this.mesh)
  }

  /**
   * The field and every particle in it, for the current viewport: one
   * instance per particle, its layer's look baked into its attributes. The
   * margin keeps the wrap out of sight and holds the largest, softest streak.
   */
  private build() {
    const { streak } = config
    let largest = 0
    for (const layer of config.layers)
      largest = Math.max(largest, layer.size[1])
    const margin = largest * 2 + streak.max
    const width = viewport.width + margin * 2
    const height = viewport.height + margin * 2
    this.uniforms.uField.value.set(width, height)

    const area = (width * height) / 1e6
    let count = 0
    for (const layer of config.layers) count += Math.round(layer.density * area)

    const seed = new Float32Array(count * 2)
    const look = new Float32Array(count * 4)
    const move = new Float32Array(count * 4)
    let n = 0
    for (const layer of config.layers) {
      const inLayer = Math.round(layer.density * area)
      for (let i = 0; i < inLayer; i++, n++) {
        seed[n * 2] = rand(n, 1)
        seed[n * 2 + 1] = rand(n, 2)
        look[n * 4] = layer.parallax
        look[n * 4 + 1] = lerp(layer.size[0], layer.size[1], rand(n, 3))
        look[n * 4 + 2] = layer.soft
        look[n * 4 + 3] = layer.alpha * lerp(0.6, 1, rand(n, 4))
        move[n * 4] = layer.drift * lerp(0.5, 1, rand(n, 5))
        move[n * 4 + 1] = layer.streak
        const tint = rand(n, 6)
        move[n * 4 + 2] =
          tint < 1 - config.tint ? 0 : tint < 1 - config.tint / 2 ? 1 : 2
        move[n * 4 + 3] = rand(n, 7)
      }
    }

    // The quad: the plane's own index and attributes, handed over rather
    // than copied (three types copy() as same-class only)
    const plane = new PlaneGeometry(1, 1)
    const geometry = new InstancedBufferGeometry()
    geometry.setIndex(plane.getIndex())
    geometry.setAttribute('position', plane.getAttribute('position'))
    geometry.setAttribute('uv', plane.getAttribute('uv'))
    geometry.instanceCount = count
    geometry.setAttribute('aSeed', new InstancedBufferAttribute(seed, 2))
    geometry.setAttribute('aLook', new InstancedBufferAttribute(look, 4))
    geometry.setAttribute('aMove', new InstancedBufferAttribute(move, 4))
    return geometry
  }

  /** `reveal` is the scene's reveal envelope: the dust fades in on it. */
  private applyTheme(theme: number, reveal = 0) {
    const u = this.uniforms
    lerpSrgb(u.uInk.value, this.ink[0], this.ink[1], theme)
    lerpSrgb(u.uAccent.value, this.accent[0], this.accent[1], theme)
    lerpSrgb(u.uCool.value, this.cool[0], this.cool[1], theme)
    u.uAlpha.value =
      lerp(config.alpha[0], config.alpha[1], theme) * ease(reveal)
  }

  update(ctx: FrameContext) {
    const { dt, scroll, pointer } = ctx
    const u = this.uniforms
    this.applyTheme(ctx.theme, ctx.reveal)

    // The scroll as the content is seen: the band moves it too
    const scrolled = scroll.y - scroll.overscroll
    // The hero's bottom edge, in world y (up, from the viewport centre); a
    // hero still unmeasured cuts everything until it is
    const heroBottom = Number.isFinite(ctx.heroHeight)
      ? ctx.heroHeight - scrolled
      : 1e9
    u.uCut.value = viewport.height / 2 - heroBottom

    if (ctx.reduced) {
      this.feel.reset()
      this.lag.set(0)
      this.pointerX.set(0)
      this.pointerY.set(0)
      u.uMotion.value = 0
      u.uTime.value = 0
      u.uVelocity.value = 0
      u.uPointer.value.set(0, 0)
      u.uScroll.value = scrolled
      return
    }

    this.feel.update(scroll.velocity, dt)

    // The field trails the page like the images do
    this.lag.target = -config.lag.max * this.feel.drive
    this.lag.update(dt)

    // The near layers step away from the pointer, through a slow spring
    const { shift } = config.pointer
    if (pointer.active) {
      this.pointerX.target =
        ((pointer.x - viewport.width / 2) / (viewport.width / 2)) * shift
      this.pointerY.target =
        (-(pointer.y - viewport.height / 2) / (viewport.height / 2)) * shift
    } else {
      this.pointerX.target = 0
      this.pointerY.target = 0
    }
    this.pointerX.update(dt)
    this.pointerY.update(dt)

    u.uMotion.value = 1
    u.uTime.value = ctx.time
    u.uVelocity.value = this.feel.velocity
    u.uPointer.value.set(this.pointerX.value, this.pointerY.value)
    u.uScroll.value = scrolled + this.lag.value
  }

  /** The viewport changed: the field is rebuilt for it, at rest. */
  resize() {
    this.mesh.geometry.dispose()
    this.mesh.geometry = this.build()
    this.feel.reset()
    this.lag.set(0)
  }

  dispose() {
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}
