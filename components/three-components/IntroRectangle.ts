import { Mesh, MeshBasicMaterial, ShapeGeometry, Vector2 } from 'three'
import { RoundedRectangleShape } from './RoundedRectangleShape'
import type { TrackedObject3D } from './ElementManager'

export class IntroRectangle
  extends Mesh<ShapeGeometry, MeshBasicMaterial>
  implements TrackedObject3D
{
  element: HTMLElement

  sizes: Vector2
  offset: Vector2
  meshSizes: Vector2

  padding: number
  cornerRadius: number

  constructor(element: HTMLElement) {
    // The geometry is a placeholder until the element has been measured; the
    // material outlives every rebuild, so it is handed to the mesh once here
    super(
      new ShapeGeometry(),
      new MeshBasicMaterial({
        color: 0xd152c4,
        transparent: true,
        opacity: 0.5,
      }),
    )
    this.element = element
    this.sizes = new Vector2(0, 0)
    this.offset = new Vector2(0, 0)
    this.meshSizes = new Vector2(0, 0)
    this.padding = this.calculatePadding()
    this.cornerRadius = this.calculateCornerRadius()
    this.buildGeometry()
  }

  getDimensions() {
    const { width, height, top, left } = this.element.getBoundingClientRect()
    this.sizes.set(width, height)
    this.offset.set(
      left - window.innerWidth / 2 + width / 2,
      -top + window.innerHeight / 2 - height / 2,
    )
    this.padding = this.calculatePadding()
    this.cornerRadius = this.calculateCornerRadius()
  }

  /**
   * Re-triangulates the rounded rectangle at the element's current size. The
   * shape is built around the origin; the mesh itself carries the offset.
   */
  buildGeometry() {
    const shape = new RoundedRectangleShape(
      0,
      0,
      this.sizes.x - this.padding * 2,
      this.sizes.y - this.padding * 2,
      this.cornerRadius,
    )
    this.geometry.dispose()
    this.geometry = new ShapeGeometry(shape)
    this.meshSizes.copy(this.sizes)
  }

  update() {
    this.updateShape()
  }

  updateShape() {
    this.getDimensions()

    // The shape only has to be re-triangulated when the element resized
    if (!this.meshSizes.equals(this.sizes)) {
      this.buildGeometry()
    }

    this.updatePosition()
  }

  updateAspectRatio() {
    this.updateShape()
  }

  updatePosition() {
    this.getDimensions()
    this.position.y = this.offset.y
    this.position.x = this.offset.x
  }

  calculatePadding() {
    if (this.sizes.x < 500) {
      return 15
    }
    if (this.sizes.x < 640) {
      return 20
    }
    return 25
  }

  calculateCornerRadius() {
    if (this.sizes.x < 500) {
      return 15
    }
    if (this.sizes.x < 640) {
      return 20
    }
    return 25
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }
}
