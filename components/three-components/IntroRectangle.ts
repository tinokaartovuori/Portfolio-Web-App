import { Mesh, MeshBasicMaterial, ShapeGeometry, Object3D } from 'three'
import { RoundedRectangleShape } from './RoundedRectangleShape'

export class IntroRectangle extends Object3D {
  mesh: Mesh | undefined
  geometry: ShapeGeometry | undefined
  material: MeshBasicMaterial | undefined
  x: number
  y: number
  windowWidth: number
  windowHeight: number
  padding: number
  cornerRadius: number

  constructor(x: number, y: number, windowWidth: number, windowHeight: number) {
    super()
    this.x = x
    this.y = y
    this.windowWidth = windowWidth
    this.windowHeight = windowHeight

    this.padding = this.calculatePadding()
    this.cornerRadius = this.calculateCornerRadius()
    this.createMesh()
  }

  createMesh() {
    const shape = new RoundedRectangleShape(
      0,
      0,
      this.windowWidth - this.padding * 2,
      this.windowHeight - this.padding * 2,
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

  updateShape(windowWidth: number, windowHeight: number) {
    this.windowWidth = windowWidth
    this.windowHeight = windowHeight
    this.padding = this.calculatePadding()
    this.cornerRadius = this.calculateCornerRadius()

    this.geometry?.dispose()
    this.material?.dispose()

    if (!this.mesh) return
    this.remove(this.mesh)
    this.createMesh()
  }

  calculatePadding() {
    if (this.windowWidth < 500) {
      return 15
    }
    if (this.windowWidth < 640) {
      return 20
    }
    return 25
  }

  calculateCornerRadius() {
    if (this.windowWidth < 500) {
      return 15
    }
    if (this.windowWidth < 640) {
      return 20
    }
    return 25
  }
}
