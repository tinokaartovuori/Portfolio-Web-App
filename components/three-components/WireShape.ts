import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  EdgesGeometry,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  Vector2,
} from 'three'
import { Spring } from '~/utils/spring'
import { ScrollFeel } from '~/utils/scrollFeel'
import { cursorUvIn } from '~/utils/cursorUv'
import { motion } from '~/motion.config'
import type { TrackedObject3D } from './ElementManager'
import type { FrameContext } from './FrameContext'

const config = motion.wireShape

/** Unit-ish solids; the mesh is scaled to the box, so these only set proportions. */
const SHAPES = {
  cube: () => new BoxGeometry(1, 1, 1),
  pyramid: () => new ConeGeometry(0.74, 1, 4),
  octahedron: () => new OctahedronGeometry(0.7),
  icosahedron: () => new IcosahedronGeometry(0.66),
}
export type WireShapeName = keyof typeof SHAPES
const DEFAULT_SHAPE: WireShapeName = 'cube'

/**
 * A wireframe solid pinned to a DOM box: it turns slowly at rest, faster
 * with the scroll, and under the pointer grows, brightens and tilts toward
 * it. Drawn in the text colour, so it reads as part of the typography.
 *
 * The mesh itself draws nothing — its geometry is empty — and carries a
 * LineSegments child built from the solid's edges, which is what a clean
 * wireframe needs: `wireframe: true` on a material would draw every triangle
 * edge, diagonals across each face included.
 *
 * `variant` names the solid: cube, pyramid, octahedron or icosahedron.
 */
export class WireShape
  extends Mesh<BufferGeometry, MeshBasicMaterial>
  implements TrackedObject3D
{
  element: HTMLElement
  sizes = new Vector2()
  offset = new Vector2()
  lines: LineSegments<EdgesGeometry, LineBasicMaterial>

  private feel = new ScrollFeel(motion.scrollFeel)
  private lag = new Spring(config.lag)
  private hover = new Spring(config.hoverSpring)
  private tiltX = new Spring(config.tiltSpring)
  private tiltY = new Spring(config.tiltSpring)
  /** Accumulated turn, radians. */
  private angle = 0
  private colors: [Color, Color]

  constructor(element: HTMLElement, variant?: string) {
    super(new BufferGeometry(), new MeshBasicMaterial({ visible: false }))
    this.element = element

    const solid = SHAPES[resolveShape(variant)]()
    this.lines = new LineSegments(
      new EdgesGeometry(solid),
      new LineBasicMaterial({ transparent: true, depthWrite: false }),
    )
    solid.dispose()
    this.add(this.lines)

    const { base } = motion.palette
    this.colors = [new Color(base[0]), new Color(base[1])]

    this.update()
  }

  measure() {
    const { width, height, top, left } = this.element.getBoundingClientRect()
    this.sizes.set(width, height)
    this.offset.set(
      left - window.innerWidth / 2 + width / 2,
      -top + window.innerHeight / 2 - height / 2,
    )
  }

  private size() {
    return Math.max(1, Math.min(this.sizes.x, this.sizes.y) * config.fill)
  }

  update() {
    this.measure()
    this.lag.set(0)
    this.feel.reset()
    this.hover.set(0)
    this.tiltX.set(0)
    this.tiltY.set(0)
    this.position.set(this.offset.x, this.offset.y, 0)
    const size = this.size()
    this.scale.set(size, size, size)
    this.rotation.set(0.5, this.angle, 0.15)
  }

  updateAspectRatio() {
    this.update()
  }

  updatePosition(ctx: FrameContext) {
    this.measure()
    const { dt, theme } = ctx
    const material = this.lines.material
    material.color.lerpColors(this.colors[0], this.colors[1], theme)
    const baseOpacity =
      config.opacity[0] + (config.opacity[1] - config.opacity[0]) * theme

    if (ctx.reduced) {
      this.lag.set(0)
      this.position.set(this.offset.x, this.offset.y, 0)
      const size = this.size()
      this.scale.set(size, size, size)
      this.rotation.set(0.5, 0.8, 0.15)
      material.opacity = baseOpacity
      return
    }

    this.feel.update(ctx.scroll.velocity, dt)
    const { drive } = this.feel
    this.lag.target = -config.lag.max * drive
    this.lag.update(dt)

    // Turn on its own, and with the scroll — in the scroll's direction
    this.angle += (config.idleSpin + config.scrollSpin * drive) * dt

    // Under the pointer: grow, brighten, and tip toward it
    const { x: width, y: height } = this.sizes
    const left = window.innerWidth / 2 + this.offset.x - width / 2
    const top = window.innerHeight / 2 - this.offset.y - height / 2
    const cursor = cursorUvIn(
      ctx.pointer,
      left,
      top,
      width,
      height,
      cursorScratch,
    )
    this.hover.target = cursor ? 1 : 0
    if (cursor) {
      this.tiltX.target = (cursor.y - 0.5) * 2 * config.tilt
      this.tiltY.target = -(cursor.x - 0.5) * 2 * config.tilt
    } else {
      this.tiltX.target = 0
      this.tiltY.target = 0
    }
    this.hover.update(dt)
    this.tiltX.update(dt)
    this.tiltY.update(dt)
    const hover = Math.max(0, this.hover.value)

    this.position.set(this.offset.x, this.offset.y + this.lag.value, 0)
    const size = this.size() * (1 + config.lift * hover)
    this.scale.set(size, size, size)
    this.rotation.set(
      0.5 + this.angle * 0.6 + this.tiltX.value,
      this.angle + this.tiltY.value,
      0.15,
    )
    material.opacity = baseOpacity + config.hoverOpacity * hover
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
    this.lines.geometry.dispose()
    this.lines.material.dispose()
  }
}

function resolveShape(variant: string | undefined): WireShapeName {
  if (variant && variant in SHAPES) return variant as WireShapeName
  if (import.meta.dev && variant) {
    console.warn(
      `[WireShape] unknown variant "${variant}", using "${DEFAULT_SHAPE}". Known variants: ${Object.keys(
        SHAPES,
      ).join(', ')}.`,
    )
  }
  return DEFAULT_SHAPE
}

const cursorScratch = new Vector2()
