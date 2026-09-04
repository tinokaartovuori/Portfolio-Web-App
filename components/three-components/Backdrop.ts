import {
  AmbientLight,
  BufferGeometry,
  Color,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Scene,
} from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
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

interface Blob {
  mesh: Mesh<BufferGeometry, MeshStandardMaterial>
  /** Share of the page below the hero this blob lives at, 0..1. */
  along: number
  x: number
  y: number
  z: number
  size: number
  phase: number
  spin: number
}

/**
 * The lit part of the scene: what gives the page depth behind the images.
 *
 * Far behind the page a wide, softly undulating matte surface in the page
 * colour; between it and the page a handful of slowly tumbling matte forms;
 * and real coloured point lights — one beside each project image on its
 * page-edge side, one following the pointer — that fall on both. Nothing
 * here glows: the colour is light on a surface, so it has shading and
 * distance. The images, the light field and the wire shapes are unlit
 * materials and do not take the light.
 *
 * Unlit, the surface and the forms are exactly the page colour: an ambient
 * light is set so that ambient × albedo equals it, on either theme. The forms
 * are therefore invisible until a light passes them.
 *
 * Everything but the pointer light is anchored below the hero and moves with
 * the page in world space, so the parallax is the camera's own. The lights
 * fade in as the hero scrolls away; the hero keeps its own light field.
 */
export default class Backdrop {
  private scene: Scene
  private ambient: AmbientLight
  private surface: Mesh<PlaneGeometry, MeshStandardMaterial>
  private material: MeshStandardMaterial
  /** The forms' own: fully matte, so no light leaves a hot spot on them. */
  private blobMaterial: MeshStandardMaterial
  private blobs: Blob[] = []
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
  private lastHero = -1
  private angle = 0

  constructor(scene: Scene) {
    this.scene = scene
    const { palette } = motion
    // The page colours are the albedo targets; the material is a flat grey
    // and the ambient light makes up the difference (see update)
    this.page = [new Color(palette.page[0]), new Color(palette.page[1])]
    this.accent = [new Color(palette.accent[0]), new Color(palette.accent[1])]
    this.cool = [new Color(palette.cool[0]), new Color(palette.cool[1])]

    this.material = new MeshStandardMaterial({
      color: new Color(config.albedo, config.albedo, config.albedo),
      roughness: config.roughness,
      metalness: 0,
    })
    this.blobMaterial = new MeshStandardMaterial({
      color: new Color(config.albedo, config.albedo, config.albedo),
      roughness: 1,
      metalness: 0,
    })

    this.ambient = new AmbientLight(0xffffff, 1)
    scene.add(this.ambient)

    this.surface = new Mesh(new PlaneGeometry(1, 1), this.material)
    this.surface.frustumCulled = false
    scene.add(this.surface)

    for (let i = 0; i < config.blobs.count; i++) {
      const blob = this.makeBlob(i)
      this.blobs.push(blob)
      scene.add(blob.mesh)
    }

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

  private makeBlob(i: number): Blob {
    const { blobs } = config
    // IcosahedronGeometry is unindexed — every face its own vertices — so
    // its normals come out flat; merge the vertices first and the shading
    // is smooth
    const geometry = mergeVertices(new IcosahedronGeometry(1, 5))
    const positions = geometry.attributes.position!
    const seed = rand(i, 9) * 10
    // A pebble: the sphere pushed in and out by a few sines
    for (let v = 0; v < positions.count; v++) {
      const x = positions.getX(v)
      const y = positions.getY(v)
      const z = positions.getZ(v)
      const n =
        Math.sin(x * 3.1 + seed) * Math.sin(y * 2.7 - seed) * 0.5 +
        Math.sin(z * 2.3 + y * 1.4 + seed * 1.7) * 0.5
      const r = 1 + blobs.noise * n
      positions.setXYZ(v, x * r, y * r, z * r)
    }
    positions.needsUpdate = true
    geometry.computeVertexNormals()

    const [far, near] = blobs.depth
    const [small, large] = blobs.size
    return {
      mesh: new Mesh(geometry, this.blobMaterial),
      along: (i + 0.5) / blobs.count,
      x: (rand(i, 2) - 0.5) * 2,
      y: (rand(i, 3) - 0.5) * 2,
      z: far + (near - far) * rand(i, 1),
      size: small + (large - small) * rand(i, 4),
      phase: rand(i, 5) * Math.PI * 2,
      spin: 0.6 + rand(i, 6) * 0.8,
    }
  }

  /**
   * Builds the surface for the page's height: wide enough for the viewport
   * at its depth, tall enough for the whole document, undulating in y.
   */
  private layout(max: number) {
    this.lastMax = max
    const k = (PERSPECTIVE - config.depth) / PERSPECTIVE
    const width = window.innerWidth * k * 1.4
    const height = (max + window.innerHeight) * k + window.innerHeight * k
    const { surface } = config
    const columns = Math.max(8, Math.round(width / surface.cell))
    const rows = Math.max(8, Math.round(height / surface.cell))

    const geometry = new PlaneGeometry(width, height, columns, rows)
    const positions = geometry.attributes.position!
    for (let v = 0; v < positions.count; v++) {
      const x = positions.getX(v) * surface.scale
      const y = positions.getY(v) * surface.scale
      positions.setZ(v, dune(x, y) * surface.amplitude)
    }
    positions.needsUpdate = true
    geometry.computeVertexNormals()

    this.surface.geometry.dispose()
    this.surface.geometry = geometry
    this.surfaceHeight = height
  }

  private surfaceHeight = 1

  resize() {
    this.lastMax = -1
  }

  update(ctx: FrameContext, images: WavyImage[]) {
    const { dt, time, scroll, pointer, theme } = ctx
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
      this.angle +=
        (config.blobs.tumble + config.blobs.scrollSpin * this.feel.drive) * dt
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

    // The forms, anchored below the hero
    const heroBottom = Number.isFinite(hero) ? hero : 0
    const span = Math.max(1, scroll.max - heroBottom)
    for (const blob of this.blobs) {
      const k = (PERSPECTIVE - blob.z) / PERSPECTIVE
      const halfW = (viewportW / 2) * k * config.blobs.spread
      const halfH = (viewportH / 2) * k * 0.8
      const anchor = heroBottom + blob.along * span
      const wobble = reduced ? 0 : Math.sin(time * 0.3 + blob.phase) * 24 * k
      blob.mesh.position.set(
        blob.x * halfW,
        blob.y * halfH +
          (scrolled - anchor) +
          wobble +
          (reduced ? 0 : this.lag.value * k),
        blob.z,
      )
      const size = blob.size * k
      blob.mesh.scale.set(size, size, size)
      blob.mesh.rotation.set(
        blob.phase + this.angle * blob.spin * 0.7,
        blob.phase * 0.5 + this.angle * blob.spin,
        blob.phase,
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
    for (const blob of this.blobs) {
      this.scene.remove(blob.mesh)
      blob.mesh.geometry.dispose()
    }
    for (const light of this.imageLights) this.scene.remove(light)
    this.material.dispose()
    this.blobMaterial.dispose()
  }
}

const pageScratch = new Color()
