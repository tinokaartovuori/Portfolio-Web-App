import {
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  Scene,
  ShaderMaterial,
  Vector3,
} from 'three'
import { Spring } from '~/utils/spring'
import { ScrollFeel } from '~/utils/scrollFeel'
import { motion } from '~/motion.config'
import { PERSPECTIVE } from './Scenario'
import type { FrameContext } from './FrameContext'

const config = motion.lightCloud

type LightCloudUniforms = {
  uColorA: { value: Color }
  uColorB: { value: Color }
  uIntensity: { value: number }
  /** Vertical elongation from scroll energy, 1 at rest. */
  uStretch: { value: number }
  uGrain: { value: number }
}

const vertexShader = /* glsl */ `
  attribute float aHue;
  attribute float aSoft;
  uniform float uStretch;
  varying vec2 vUv;
  varying float vHue;
  varying float vSoft;

  void main() {
    vUv = uv;
    vHue = aHue;
    vSoft = aSoft;
    vec3 p = position;
    p.y *= uStretch;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uIntensity;
  uniform float uGrain;
  varying vec2 vUv;
  varying float vHue;
  varying float vSoft;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    // A soft disc: the nearer the camera, the softer, like a lens out of focus
    vec2 d = vUv - 0.5;
    float sigma = mix(0.16, 0.27, vSoft);
    float g = exp(-dot(d, d) / (2.0 * sigma * sigma));
    // The quad's own edge must never show
    float mask = smoothstep(0.5, 0.42, max(abs(d.x), abs(d.y)));
    float a = g * mask * uIntensity;
    a = clamp(a + (hash12(gl_FragCoord.xy) - 0.5) * uGrain / 255.0, 0.0, 1.0);
    gl_FragColor = vec4(mix(uColorA, uColorB, vHue), a);
    #include <colorspace_fragment>
  }
`

interface CloudLight {
  /** Scroll position at which the light passes the viewport centre. */
  anchor: number
  /** Share of the page this light lives at, 0..1. */
  along: number
  /** Rest offset from the centre line, in world units at its depth. */
  x: number
  y: number
  z: number
  /** Screen size at rest, px. */
  size: number
  hue: number
  phase: number
  pullX: Spring
  pullY: Spring
}

/** Deterministic 0..1 per (index, salt); the cloud must not reshuffle on a rebuild. */
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * A cloud of large, soft lights through the whole page at different depths.
 *
 * Not pinned to any element: each light is anchored to a scroll position and
 * a depth. It moves with the page in world space, so the deeper ones cross
 * the screen more slowly and the nearer ones faster — the parallax is the
 * camera's own — and the nearer ones are drawn larger and softer, like a
 * lens out of focus. Scroll energy stretches them and the trail drags them,
 * the pointer pulls the ones near it, and the palette is the hero's.
 */
export default class LightCloud {
  mesh: InstancedMesh<PlaneGeometry, ShaderMaterial>
  shaderUniforms: LightCloudUniforms
  private scene: Scene
  private lights: CloudLight[] = []
  private feel = new ScrollFeel(motion.scrollFeel)
  private lag = new Spring(config.lag)
  private accent: [Color, Color]
  private cool: [Color, Color]
  private lastMax = -1

  constructor(scene: Scene) {
    const { palette } = motion
    this.accent = [new Color(palette.accent[0]), new Color(palette.accent[1])]
    this.cool = [new Color(palette.cool[0]), new Color(palette.cool[1])]

    const geometry = new PlaneGeometry(1, 1)
    const hues = new Float32Array(config.count)
    const softs = new Float32Array(config.count)
    for (let i = 0; i < config.count; i++) {
      const light = this.makeLight(i)
      this.lights.push(light)
      hues[i] = light.hue
      const [near, far] = [config.depth[1], config.depth[0]]
      softs[i] = (light.z - far) / (near - far)
    }
    geometry.setAttribute('aHue', new InstancedBufferAttribute(hues, 1))
    geometry.setAttribute('aSoft', new InstancedBufferAttribute(softs, 1))

    this.shaderUniforms = {
      uColorA: { value: new Color() },
      uColorB: { value: new Color() },
      uIntensity: { value: 0 },
      uStretch: { value: 1 },
      uGrain: { value: config.grain },
    }
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.shaderUniforms,
      transparent: true,
      depthWrite: false,
    })

    this.mesh = new InstancedMesh(geometry, material, config.count)
    this.mesh.frustumCulled = false
    this.scene = scene
    scene.add(this.mesh)
  }

  private makeLight(i: number): CloudLight {
    const [far, near] = config.depth
    const z = far + (near - far) * rand(i, 1)
    const [small, large] = config.size
    return {
      anchor: 0,
      along: (i + 0.5) / config.count,
      x: (rand(i, 2) - 0.5) * 2,
      y: (rand(i, 3) - 0.5) * 2,
      z,
      size: small + (large - small) * rand(i, 4),
      hue: i % 2,
      phase: rand(i, 5) * Math.PI * 2,
      pullX: new Spring(config.cursor.spring),
      pullY: new Spring(config.cursor.spring),
    }
  }

  /** Spreads the anchors over the page; called when its height changes. */
  private layout(max: number) {
    this.lastMax = max
    for (const light of this.lights) light.anchor = light.along * max
  }

  resize() {
    this.lastMax = -1
  }

  update(ctx: FrameContext) {
    const { dt, time, scroll, pointer, theme } = ctx
    if (Math.abs(scroll.max - this.lastMax) > 1) this.layout(scroll.max)

    const u = this.shaderUniforms
    u.uColorA.value.lerpColors(this.accent[0], this.accent[1], theme)
    u.uColorB.value.lerpColors(this.cool[0], this.cool[1], theme)
    u.uIntensity.value =
      config.intensity[0] + (config.intensity[1] - config.intensity[0]) * theme

    const reduced = ctx.reduced
    if (reduced) {
      this.feel.reset()
      this.lag.set(0)
      u.uStretch.value = 1
    } else {
      this.feel.update(scroll.velocity, dt)
      this.lag.target = -config.lag.max * this.feel.drive
      this.lag.update(dt)
      u.uStretch.value = 1 + config.stretch * this.feel.energy
    }

    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    // The rubber band moves the page; the cloud goes with it
    const scrolled = scroll.y - scroll.overscroll
    const cursorX = pointer.x - viewportW / 2
    const cursorY = viewportH / 2 - pointer.y
    const { drift, cursor } = config

    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i]!
      // What the viewport spans at this depth, in world units
      const k = (PERSPECTIVE - light.z) / PERSPECTIVE
      const halfW = (viewportW / 2) * k * config.spread
      const halfH = (viewportH / 2) * k * config.spread

      let x = light.x * halfW
      let y = light.y * halfH + (scrolled - light.anchor)
      if (!reduced) {
        x += Math.cos(time * drift.speed + light.phase) * drift.amplitude * k
        y +=
          Math.sin(time * drift.speed * 0.8 + light.phase) *
            drift.amplitude *
            k +
          this.lag.value * k

        // The pointer pulls a light that is near it on screen
        let pullX = 0
        let pullY = 0
        if (pointer.active) {
          const sx = x / k
          const sy = y / k
          const dx = cursorX - sx
          const dy = cursorY - sy
          const distance = Math.hypot(dx, dy)
          if (distance < cursor.radius && distance > 0) {
            const pull = cursor.strength * (1 - distance / cursor.radius)
            pullX = dx * pull * k
            pullY = dy * pull * k
          }
        }
        light.pullX.target = pullX
        light.pullY.target = pullY
        x += light.pullX.update(dt)
        y += light.pullY.update(dt)
      }

      // Screen size at rest, as a world size at this depth
      const size = light.size * k
      position.set(x, y, light.z)
      scale.set(size, size, 1)
      matrix.compose(position, quaternion, scale)
      this.mesh.setMatrixAt(i, matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  dispose() {
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
    this.mesh.dispose()
  }
}

// Scratch objects, so the per-frame update allocates nothing
const matrix = new Matrix4()
const position = new Vector3()
const scale = new Vector3(1, 1, 1)
const quaternion = new Quaternion()
