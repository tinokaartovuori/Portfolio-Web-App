import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  Scene,
  ShaderMaterial,
} from 'three'
import { Spring } from '~/utils/spring'
import { ScrollFeel } from '~/utils/scrollFeel'
import { motion } from '~/motion.config'
import { PERSPECTIVE } from './Scenario'
import type { FrameContext } from './FrameContext'

const config = motion.bands

/** Deterministic 0..1 per (index, salt); the bands must not reshuffle on a rebuild. */
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Smooth 0..1 ramp. */
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

type BandUniforms = {
  uColor: { value: Color }
  uAlpha: { value: number }
  uOn: { value: number }
}

const vertexShader = /* glsl */ `
  attribute float aSide;
  attribute float aSoft;
  varying float vSide;
  varying float vSoft;

  void main() {
    vSide = aSide;
    vSoft = aSoft;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uOn;
  varying float vSide;
  varying float vSoft;

  void main() {
    // Across a strand: a crisp hairline far away, a soft blur up close
    float d = abs(vSide);
    float crisp = 1.0 - smoothstep(0.5, 1.0, d);
    float soft = exp(-d * d * 3.0) * (1.0 - d * d);
    float across = mix(crisp, soft, vSoft);
    // The near, blurred strands are also fainter, as a blur is
    float a = across * uAlpha * mix(1.0, 0.55, vSoft) * uOn;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`

interface Band {
  z: number
  /** Perspective ratio at this depth: world units per screen px. */
  k: number
  /** 0 far and crisp .. 1 near and soft. */
  soft: number
  /** Strand width, screen px. */
  width: number
  /** Scroll position the band is centred on. */
  anchor: number
  along: number
  /** Where the band crosses the centre line, and its tilt, in screen px. */
  y0: number
  tilt: number
  /** Wave terms: amplitude (screen px), frequency (1/px), phase, rate (rad/s). */
  waves: { amplitude: number; frequency: number; phase: number; rate: number }[]
  /** How the strand spacing swells and pinches along the band. */
  fan: { frequency: number; phase: number; rate: number }
}

/**
 * Bands of parallel lines flowing through the depth behind the page.
 *
 * Each band is a bundle of strands that follow one smooth, slowly waving
 * path across the viewport, spaced a few px apart across it, the spacing
 * swelling and pinching along the way so the bundle fans open and closes.
 * The bands live at depths well behind the page and move with it in world
 * space, so the parallax is the camera's own; the near ones are drawn wide
 * and blurred, the far ones as crisp hairlines, which is what makes the
 * depth read. Their waves travel slowly on their own, scrolling quickens
 * them and pulls them along, and the pointer bends the path near it. One
 * colour, the text colour, at a low alpha.
 *
 * Anchored below the hero, so the hero keeps its own light field; a page
 * without a hero has them from the top.
 */
export default class LineBands {
  mesh: Mesh<BufferGeometry, ShaderMaterial>
  shaderUniforms: BandUniforms
  private scene: Scene
  private bands: Band[] = []
  private positions: Float32Array
  private feel = new ScrollFeel(motion.scrollFeel)
  private lag = new Spring(config.lag)
  private cursorX = new Spring(config.cursor.spring)
  private cursorY = new Spring(config.cursor.spring)
  private colors: [Color, Color]
  private lastMax = -1
  private lastHero = Number.NaN
  private time = 0
  /** Path scratch: x, y, nx, ny per point, in world units at the band's depth. */
  private path: Float32Array

  constructor(scene: Scene) {
    this.scene = scene
    const { base } = motion.palette
    this.colors = [new Color(base[0]), new Color(base[1])]

    const { count, strands, points } = config
    const vertices = count * strands * points * 2
    this.positions = new Float32Array(vertices * 3)
    this.path = new Float32Array(points * 4)
    const sides = new Float32Array(vertices)
    const softs = new Float32Array(vertices)
    const indices: number[] = []

    for (let b = 0; b < count; b++) {
      const band = this.makeBand(b)
      this.bands.push(band)
      for (let s = 0; s < strands; s++) {
        for (let i = 0; i < points; i++) {
          const v = ((b * strands + s) * points + i) * 2
          sides[v] = -1
          sides[v + 1] = 1
          softs[v] = softs[v + 1] = band.soft
          if (i < points - 1) {
            indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2)
          }
        }
      }
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3))
    geometry.setAttribute('aSide', new BufferAttribute(sides, 1))
    geometry.setAttribute('aSoft', new BufferAttribute(softs, 1))
    geometry.setIndex(indices)

    this.shaderUniforms = {
      uColor: { value: new Color() },
      uAlpha: { value: 0 },
      uOn: { value: 0 },
    }
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.shaderUniforms,
      transparent: true,
      depthWrite: false,
      // The ribbon's winding follows its direction of travel, which the
      // waves and the pointer turn either way; neither side may be culled
      side: DoubleSide,
    })
    this.mesh = new Mesh(geometry, material)
    this.mesh.frustumCulled = false
    scene.add(this.mesh)
  }

  private makeBand(i: number): Band {
    const [far, near] = config.depth
    const soft = rand(i, 1)
    const z = far + (near - far) * soft
    const { wave } = config
    const waves = []
    for (let w = 0; w < 3; w++) {
      const share = [1, 0.45, 0.2][w]!
      waves.push({
        amplitude: wave.amplitude * share * (0.7 + rand(i, 10 + w) * 0.6),
        frequency:
          (wave.frequency * [1, 2.3, 4.1][w]!) / (0.8 + rand(i, 20 + w) * 0.4),
        phase: rand(i, 30 + w) * Math.PI * 2,
        rate: wave.rate * (0.6 + rand(i, 40 + w) * 0.8) * (w % 2 ? -1 : 1),
      })
    }
    return {
      z,
      k: (PERSPECTIVE - z) / PERSPECTIVE,
      soft,
      width: config.width[0] + (config.width[1] - config.width[0]) * soft,
      anchor: 0,
      along: (i + 0.5) / config.count,
      y0: (rand(i, 2) - 0.5) * window.innerHeight * 0.6,
      tilt: (rand(i, 3) - 0.5) * 2 * config.tilt,
      waves,
      fan: {
        frequency: config.fan.frequency * (0.7 + rand(i, 4) * 0.6),
        phase: rand(i, 5) * Math.PI * 2,
        rate: config.fan.rate * (0.6 + rand(i, 6) * 0.8),
      },
    }
  }

  /** Spreads the bands over the page below the hero. */
  private layout(max: number, hero: number) {
    this.lastMax = max
    this.lastHero = hero
    const span = Math.max(1, max - hero)
    for (const band of this.bands) band.anchor = hero + band.along * span
  }

  resize() {
    this.lastMax = -1
  }

  /**
   * The band's centre path at this moment, in screen px around the band's
   * own centre: a tilted line across the viewport with travelling waves on
   * it, bent near the pointer. Also its unit normals.
   */
  private tracePath(
    band: Band,
    quicken: number,
    cursor: { x: number; y: number } | null,
    offsetY: number,
  ) {
    const { points } = config
    const halfW = (window.innerWidth / 2) * config.extent
    const t = this.time * quicken
    const path = this.path
    const { radius, bend } = config.cursor

    for (let i = 0; i < points; i++) {
      const x = -halfW + (i / (points - 1)) * halfW * 2
      let y = band.y0 + band.tilt * x
      for (const wave of band.waves) {
        y +=
          wave.amplitude *
          Math.sin(x * wave.frequency + wave.phase + t * wave.rate)
      }
      path[i * 4] = x
      path[i * 4 + 1] = y
    }

    // The pointer pushes the path away from itself
    if (cursor) {
      for (let i = 0; i < points; i++) {
        const dx = path[i * 4]! - cursor.x
        const dy = path[i * 4 + 1]! + offsetY - cursor.y
        const d2 = dx * dx + dy * dy
        if (d2 < radius * radius * 4) {
          const push = bend * Math.exp(-d2 / (2 * radius * radius))
          path[i * 4 + 1]! += dy >= 0 ? push : -push
        }
      }
    }

    for (let i = 0; i < points; i++) {
      const a = Math.max(0, i - 1)
      const b = Math.min(points - 1, i + 1)
      let dx = path[b * 4]! - path[a * 4]!
      let dy = path[b * 4 + 1]! - path[a * 4 + 1]!
      const length = Math.hypot(dx, dy) || 1
      dx /= length
      dy /= length
      path[i * 4 + 2] = -dy
      path[i * 4 + 3] = dx
    }
  }

  update(ctx: FrameContext) {
    const { dt, scroll, pointer, theme } = ctx
    const hero = Number.isFinite(ctx.heroHeight) ? ctx.heroHeight : 0
    if (Math.abs(scroll.max - this.lastMax) > 1 || hero !== this.lastHero) {
      this.layout(scroll.max, hero)
    }

    const u = this.shaderUniforms
    u.uColor.value.lerpColors(this.colors[0], this.colors[1], theme)
    u.uAlpha.value =
      config.alpha[0] + (config.alpha[1] - config.alpha[0]) * theme

    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    // The rubber band moves the page; the bands go with it
    const scrolled = scroll.y - scroll.overscroll

    // Nothing over the hero: they come in as it scrolls away
    const from = ctx.heroHeight - viewportH
    u.uOn.value = !Number.isFinite(ctx.heroHeight)
      ? 0
      : hero === 0
        ? 1
        : smoothstep(from, from + viewportH * config.fadeSpan, scroll.y)

    let quicken = 1
    let cursor: { x: number; y: number } | null = null
    if (ctx.reduced) {
      this.feel.reset()
      this.lag.set(0)
    } else {
      this.feel.update(scroll.velocity, dt)
      this.lag.target = -config.lag.max * this.feel.drive
      this.lag.update(dt)
      quicken = 1 + config.scroll.boost * this.feel.energy
      this.time += dt * quicken
      if (pointer.active) {
        this.cursorX.target = pointer.x - viewportW / 2
        this.cursorY.target = viewportH / 2 - pointer.y
      }
      this.cursorX.update(dt)
      this.cursorY.update(dt)
      if (pointer.active) {
        cursor = cursorScratch
        cursor.x = this.cursorX.value
        cursor.y = this.cursorY.value
      }
    }

    const { strands, points } = config
    const positions = this.positions
    const path = this.path

    for (let b = 0; b < this.bands.length; b++) {
      const band = this.bands[b]!
      const { k, z } = band
      // Where the band's centre sits on screen right now, y up
      const offsetY = (scrolled - band.anchor + this.lag.value * k) / k
      this.tracePath(band, 1, cursor, offsetY)

      const half = band.width * 0.5
      for (let s = 0; s < strands; s++) {
        const across = s - (strands - 1) / 2
        for (let i = 0; i < points; i++) {
          const px = path[i * 4]!
          const py = path[i * 4 + 1]!
          const nx = path[i * 4 + 2]!
          const ny = path[i * 4 + 3]!
          // The fan: spacing swells and pinches along the band
          const spacing =
            config.spacing *
            (1 +
              config.fan.amount *
                Math.sin(
                  px * band.fan.frequency +
                    band.fan.phase +
                    this.time * band.fan.rate,
                ))
          const cx = px + nx * across * spacing
          const cy = py + ny * across * spacing + offsetY

          const v = ((b * strands + s) * points + i) * 2
          const p = v * 3
          // Screen px → world units at this depth
          positions[p] = (cx - nx * half) * k
          positions[p + 1] = (cy - ny * half) * k
          positions[p + 2] = z
          positions[p + 3] = (cx + nx * half) * k
          positions[p + 4] = (cy + ny * half) * k
          positions[p + 5] = z
        }
      }
    }

    this.mesh.geometry.attributes.position!.needsUpdate = true
  }

  dispose() {
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}

const cursorScratch = { x: 0, y: 0 }
