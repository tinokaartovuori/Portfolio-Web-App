import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
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
import { PERSPECTIVE } from './Scenario'
import type { TrackedObject3D } from './ElementManager'
import { arrivalFor, advance, type Arrival } from './Arrival'
import type { FrameContext } from './FrameContext'
import { viewport } from './Viewport'

const config = motion.wireShape

/** The edges of a solid, as the line geometry a wireframe is made of. */
const edgesOf = (solid: BufferGeometry) => {
  const edges = new EdgesGeometry(solid)
  solid.dispose()
  return edges
}

/**
 * A globe: three parallels and four meridians. An EdgesGeometry of a sphere
 * would draw every triangle; this is the schoolbook drawing of one.
 */
function globe(radius: number, segments = 48) {
  const points: number[] = []
  const ring = (point: (angle: number) => [number, number, number]) => {
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2
      const b = ((i + 1) / segments) * Math.PI * 2
      points.push(...point(a), ...point(b))
    }
  }
  for (const latitude of [-0.5, 0, 0.5]) {
    const y = Math.sin(latitude) * radius
    const r = Math.cos(latitude) * radius
    ring((a) => [Math.cos(a) * r, y, Math.sin(a) * r])
  }
  for (let m = 0; m < 4; m++) {
    const spin = (m / 4) * Math.PI
    ring((a) => [
      Math.cos(a) * radius * Math.cos(spin),
      Math.sin(a) * radius,
      Math.cos(a) * radius * Math.sin(spin),
    ])
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3))
  return geometry
}

/** Unit-ish solids; the mesh is scaled to the box, so these only set proportions. */
const SHAPES = {
  cube: () => edgesOf(new BoxGeometry(1, 1, 1)),
  pyramid: () => edgesOf(new ConeGeometry(0.74, 1, 4)),
  octahedron: () => edgesOf(new OctahedronGeometry(0.7)),
  globe: () => globe(0.62),
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
 * It faces the camera before it turns. The camera sees a shape at the side
 * of the viewport from an angle, and a solid with real depth then looks
 * sheared there and square in the middle; turning it to face the camera
 * first makes every shape read the same wherever it is on the page.
 *
 * `variant` names the solid: cube, pyramid, octahedron or globe.
 */
export class WireShape
  extends Mesh<BufferGeometry, MeshBasicMaterial>
  implements TrackedObject3D
{
  element: HTMLElement
  sizes = new Vector2()
  offset = new Vector2()
  lines: LineSegments<BufferGeometry, LineBasicMaterial>

  private feel = new ScrollFeel(motion.scrollFeel)
  private hover = new Spring(config.hoverSpring)
  private tiltX = new Spring(config.tiltSpring)
  private tiltY = new Spring(config.tiltSpring)
  /** Accumulated turn, radians. */
  private angle = 0
  private colors: [Color, Color]
  /** Fades in on arrival like the lights do; on the element, so a rebuild
   * does not replay it. */
  private arrival: Arrival

  constructor(element: HTMLElement, variant?: string) {
    super(new BufferGeometry(), new MeshBasicMaterial({ visible: false }))
    this.element = element
    this.arrival = arrivalFor(element)

    this.lines = new LineSegments(
      SHAPES[resolveShape(variant)](),
      new LineBasicMaterial({ transparent: true, depthWrite: false }),
    )
    this.add(this.lines)

    const { base } = motion.palette
    this.colors = [new Color(base[0]), new Color(base[1])]

    this.update()
  }

  measure() {
    const { width, height, top, left } = this.element.getBoundingClientRect()
    this.sizes.set(width, height)
    this.offset.set(
      left - viewport.width / 2 + width / 2,
      -(top - viewport.top) + viewport.height / 2 - height / 2,
    )
  }

  private size() {
    return Math.max(1, Math.min(this.sizes.x, this.sizes.y) * config.fill)
  }

  /** Faces the camera, then turns: the turn is the same on every part of the page. */
  private orient(x: number, y: number) {
    this.lookAt(0, 0, PERSPECTIVE)
    this.rotateX(x)
    this.rotateY(y)
    this.rotateZ(0.15)
  }

  update() {
    this.measure()
    this.feel.reset()
    this.hover.set(0)
    this.tiltX.set(0)
    this.tiltY.set(0)
    this.position.set(this.offset.x, this.offset.y, 0)
    const size = this.size()
    this.scale.set(size, size, size)
    this.orient(0.5, this.angle)
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

    // Drawn from nothing once the scene has rendered, on the lights' timing
    const arrived =
      this.arrival.t >= 1
        ? 1
        : ctx.rendered
          ? advance(
              this.arrival,
              dt,
              motion.reveal.lights.duration,
              ctx.reduced,
            )
          : 0

    // The box carries the page trail, so the shape sits exactly on it
    this.position.set(this.offset.x, this.offset.y, 0)

    if (ctx.reduced) {
      const size = this.size()
      this.scale.set(size, size, size)
      this.orient(0.5, 0.8)
      material.opacity = baseOpacity * arrived
      return
    }

    this.feel.update(ctx.scroll.velocity, dt)
    const { drive } = this.feel

    // Turn on its own, and with the scroll — in the scroll's direction
    this.angle += (config.idleSpin + config.scrollSpin * drive) * dt

    // Under the pointer: grow, brighten, and tip toward it
    const { x: width, y: height } = this.sizes
    const left = viewport.width / 2 + this.offset.x - width / 2
    const top = viewport.height / 2 - this.offset.y - height / 2 + viewport.top
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

    const size = this.size() * (1 + config.lift * hover)
    this.scale.set(size, size, size)
    this.orient(
      0.5 + this.angle * 0.6 + this.tiltX.value,
      this.angle + this.tiltY.value,
    )
    material.opacity = (baseOpacity + config.hoverOpacity * hover) * arrived
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
