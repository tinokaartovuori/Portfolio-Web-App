import {
  AmbientLight,
  BufferGeometry,
  Color,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Scene,
} from 'three'
import { Spring } from '~/utils/spring'
import { ScrollFeel } from '~/utils/scrollFeel'
import { motion } from '~/motion.config'
import { PERSPECTIVE } from './Scenario'
import type { FrameContext } from './FrameContext'
import type WavyImage from './WavyImage'

const config = motion.backdrop

/** Deterministic 0..1 per (index, salt); the backdrop must not reshuffle on a rebuild. */
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Smooth 0..1 ramp. */
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** A cheap 2D undulation: a few sines at unrelated angles, never tiling visibly. */
const dune = (x: number, y: number) =>
  Math.sin(x * 1.0 + y * 0.6) * 0.5 +
  Math.sin(x * 0.37 - y * 1.1 + 1.3) * 0.3 +
  Math.sin(x * 1.7 + y * 1.9 + 2.1) * 0.2

/**
 * The lit part of the scene: what gives the page depth behind the images.
 *
 * Far behind the page a wide, faceted matte surface in the page colour —
 * a grid whose vertices are jittered and raised, drawn flat-shaded, so it
 * reads as a low relief of geometric facets — and real point lights, one
 * beside each project image on its page-edge side and one following the
 * pointer, that fall on it. The lights are pale, tinted only a little
 * toward the palette, and dim: what shows is a quiet geometric patch of
 * light near each image, on a page that stays dark or light. The images,
 * the light field and the wire shapes are unlit materials and take none of
 * it.
 *
 * Unlit, the surface is exactly the page colour: an ambient light is set so
 * that ambient × albedo equals it, on either theme.
 *
 * The surface moves with the page in world space, so the parallax is the
 * camera's own. The lights come on as the hero scrolls away; the hero keeps
 * its own light field.
 */
export default class Backdrop {
  private scene: Scene
  private ambient: AmbientLight
  private surface: Mesh<BufferGeometry, MeshStandardMaterial>
  private material: MeshStandardMaterial
  private imageLights: PointLight[] = []
  private cursorLight: PointLight
  private cursorX = new Spring(config.lights.cursor.spring)
  private cursorY = new Spring(config.lights.cursor.spring)
  private feel = new ScrollFeel(motion.scrollFeel)
  private lag = new Spring(config.lag)
  private page: [Color, Color]
  private accent: [Color, Color]
  private cool: [Color, Color]
  private lastMax = -1
  private surfaceHeight = 1

  constructor(scene: Scene) {
    this.scene = scene
    const { palette } = motion
    // The page colours are what the surface must look like unlit; the
    // material is a flat grey and the ambient light makes up the difference
    this.page = [new Color(palette.page[0]), new Color(palette.page[1])]
    // The light colours: the palette hues pulled most of the way to a pale
    // neutral, so the light reads as light rather than as colour
    const pale = (hex: number) =>
      new Color(hex).lerp(new Color(0xffffff), config.lights.paleness)
    this.accent = [pale(palette.accent[0]), pale(palette.accent[1])]
    this.cool = [pale(palette.cool[0]), pale(palette.cool[1])]

    this.material = new MeshStandardMaterial({
      color: new Color(config.albedo, config.albedo, config.albedo),
      roughness: config.roughness,
      metalness: 0,
      flatShading: true,
    })

    this.ambient = new AmbientLight(0xffffff, 1)
    scene.add(this.ambient)

    this.surface = new Mesh(new PlaneGeometry(1, 1), this.material)
    this.surface.frustumCulled = false
    scene.add(this.surface)

    // A fixed pool: the lit shader is compiled for this many lights and
    // must not recompile when a page has fewer images
    for (let i = 0; i < config.lights.pool; i++) {
      const light = new PointLight(0xffffff, 0, 0, 2)
      this.imageLights.push(light)
      scene.add(light)
    }
    this.cursorLight = new PointLight(0xffffff, 0, 0, 2)
    scene.add(this.cursorLight)
  }

  /**
   * Builds the surface for the page's height: wide enough for the viewport
   * at its depth, tall enough for the whole document. The grid's vertices
   * are jittered in the plane and raised by an undulation plus a little
   * per-vertex noise, and the geometry is left unindexed so every triangle
   * gets its own normal: flat facets, not a smooth swell.
   */
  private layout(max: number) {
    this.lastMax = max
    const k = (PERSPECTIVE - config.depth) / PERSPECTIVE
    const width = window.innerWidth * k * 1.4
    const height = (max + window.innerHeight) * k + window.innerHeight * k
    const { surface } = config
    const columns = Math.max(6, Math.round(width / surface.cell))
    const rows = Math.max(6, Math.round(height / surface.cell))

    const grid = new PlaneGeometry(width, height, columns, rows)
    const positions = grid.attributes.position!
    for (let v = 0; v < positions.count; v++) {
      const x = positions.getX(v)
      const y = positions.getY(v)
      const jitter = surface.cell * surface.jitter
      const nx = x + (rand(v, 1) - 0.5) * jitter
      const ny = y + (rand(v, 2) - 0.5) * jitter
      const z =
        dune(x * surface.scale, y * surface.scale) * surface.amplitude +
        (rand(v, 3) - 0.5) * surface.roughen
      positions.setXYZ(v, nx, ny, z)
    }
    const geometry = grid.toNonIndexed()
    grid.dispose()
    geometry.computeVertexNormals()

    this.surface.geometry.dispose()
    this.surface.geometry = geometry
    this.surfaceHeight = height
  }

  resize() {
    this.lastMax = -1
  }

  update(ctx: FrameContext, images: WavyImage[]) {
    const { dt, scroll, pointer, theme } = ctx
    if (Math.abs(scroll.max - this.lastMax) > 1) this.layout(scroll.max)

    // Unlit = page colour: ambient × albedo/π must equal it, per channel.
    // Colours are linear here; the material's albedo is a flat grey.
    const page = pageScratch.lerpColors(this.page[0], this.page[1], theme)
    const gain = Math.PI / config.albedo
    this.ambient.color.setRGB(page.r * gain, page.g * gain, page.b * gain)

    const reduced = ctx.reduced
    if (reduced) {
      this.feel.reset()
      this.lag.set(0)
    } else {
      this.feel.update(scroll.velocity, dt)
      this.lag.target = -config.lag.max * this.feel.drive
      this.lag.update(dt)
    }

    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    // The rubber band moves the page; the backdrop goes with it
    const scrolled = scroll.y - scroll.overscroll

    // The lights come on as the hero scrolls away; a page without a hero
    // has them on from the start
    const hero = Number.isFinite(ctx.heroHeight) ? ctx.heroHeight : Infinity
    const from = hero - viewportH
    const on =
      hero === 0
        ? 1
        : smoothstep(from, from + viewportH * config.lights.fadeSpan, scroll.y)

    // The surface
    {
      const k = (PERSPECTIVE - config.depth) / PERSPECTIVE
      const top = (viewportH / 2) * k
      this.surface.position.set(
        0,
        top -
          this.surfaceHeight / 2 +
          scrolled +
          (reduced ? 0 : this.lag.value * k * 0.5),
        config.depth,
      )
    }

    // One light beside each image, on its page-edge side
    const { lights } = config
    const lightIntensity =
      (lights.intensity[0] +
        (lights.intensity[1] - lights.intensity[0]) * theme) *
      on
    for (let i = 0; i < this.imageLights.length; i++) {
      const light = this.imageLights[i]!
      const image = images[i]
      if (!image) {
        light.intensity = 0
        continue
      }
      const side = image.positionOffset.x < 0 ? -1 : 1
      light.position.set(
        image.positionOffset.x +
          side * (image.dimensions.x / 2 + lights.offset),
        image.positionOffset.y + (reduced ? 0 : this.lag.value),
        lights.depth,
      )
      light.color.lerpColors(
        i % 2 === 0 ? this.accent[0] : this.cool[0],
        i % 2 === 0 ? this.accent[1] : this.cool[1],
        theme,
      )
      light.intensity = lightIntensity
    }

    // The pointer light
    const { cursor } = lights
    if (pointer.active && !reduced) {
      this.cursorX.target = pointer.x - viewportW / 2
      this.cursorY.target = viewportH / 2 - pointer.y
    }
    this.cursorX.update(dt)
    this.cursorY.update(dt)
    this.cursorLight.position.set(
      this.cursorX.value,
      this.cursorY.value,
      cursor.depth,
    )
    this.cursorLight.color.lerpColors(this.accent[0], this.accent[1], theme)
    this.cursorLight.intensity =
      pointer.active && !reduced
        ? (cursor.intensity[0] +
            (cursor.intensity[1] - cursor.intensity[0]) * theme) *
          on
        : 0
  }

  dispose() {
    this.scene.remove(this.ambient, this.surface, this.cursorLight)
    this.surface.geometry.dispose()
    for (const light of this.imageLights) this.scene.remove(light)
    this.material.dispose()
  }
}

const pageScratch = new Color()
