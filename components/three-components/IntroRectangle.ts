import {
  Mesh,
  MeshBasicMaterial,
  ShapeGeometry,
  Object3D,
  Vector2,
} from 'three'
import { RoundedRectangleShape } from './RoundedRectangleShape'

export class IntroRectangle extends Object3D {
  mesh: Mesh | undefined
  geometry: ShapeGeometry | undefined
  material: MeshBasicMaterial | undefined
  element: HTMLDivElement

  sizes: Vector2
  offset: Vector2

  padding: number
  cornerRadius: number

  constructor(element: HTMLDivElement) {
    super()
    this.element = element
    this.sizes = new Vector2(0, 0)
    this.offset = new Vector2(0, 0)
    this.padding = this.calculatePadding()
    this.cornerRadius = this.calculateCornerRadius()
    this.createMesh()
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

  createMesh() {
    const shape = new RoundedRectangleShape(
      0,
      0,
      this.sizes.x - this.padding * 2,
      this.sizes.y - this.padding * 2,
      this.cornerRadius,
    )
    this.geometry = new ShapeGeometry(shape)
    this.material = new MeshBasicMaterial({
      color: 0xd152c4,
      transparent: true,
      opacity: 0.5,
    })
    this.mesh = new Mesh(this.geometry, this.material)
    this.add(this.mesh)
  }

  update() {
    this.updateShape()
  }

  updateShape() {
    this.getDimensions()

    this.geometry?.dispose()
    this.material?.dispose()

    if (!this.mesh) return
    this.remove(this.mesh)
    this.createMesh()
    this.updatePosition()
  }

  updateAspectRatio() {
    this.updateShape()
  }

  updatePosition() {
    if (!this.mesh) return
    // this.updateShape()
    this.getDimensions()
    this.mesh.position.y = this.offset.y
    this.mesh.position.x = this.offset.x
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
    this.mesh?.geometry.dispose()
    this.mesh?.material.dispose()
  }
}
