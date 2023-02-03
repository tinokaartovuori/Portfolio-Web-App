import {
  Mesh,
  Shape,
  MeshBasicMaterial,
  ExtrudeGeometry,
  Object3D,
} from 'three'

export class RoundedRectangle extends Object3D {
  mesh: Mesh | undefined
  geometry: ExtrudeGeometry | undefined
  material: MeshBasicMaterial | undefined
  x: number
  y: number
  width: number
  height: number
  padding: number
  cornerRadius: number

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    padding: number,
    cornerRadius: number = 25,
  ) {
    super()
    this.x = x
    this.y = y
    this.width = width
    this.height = height
    this.padding = padding
    this.cornerRadius = cornerRadius
    this.createMesh()
  }

  createMesh() {
    const shape = this.createShape()

    const extrudeSettings = {
      depth: 10,
      bevelEnabled: false,
    }
    this.geometry = new ExtrudeGeometry(shape, extrudeSettings)
    this.material = new MeshBasicMaterial({ color: 0x465d61 })
    this.mesh = new Mesh(this.geometry, this.material)
    this.add(this.mesh)
  }

  createShape() {
    const shape = new Shape()
    if (this.width < 667) {
      this.cornerRadius = 15
      this.padding = 15
    } else {
      this.cornerRadius = 25
      this.padding = 25
    }
    shape.moveTo(
      -(this.width / 2) + this.padding + this.cornerRadius,
      this.height / 2 - this.padding,
    )
    shape.lineTo(
      this.width / 2 - this.padding - this.cornerRadius,
      this.height / 2 - this.padding,
    )
    shape.quadraticCurveTo(
      this.width / 2 - this.padding,
      this.height / 2 - this.padding,
      this.width / 2 - this.padding,
      this.height / 2 - this.padding - this.cornerRadius,
    )
    shape.lineTo(
      this.width / 2 - this.padding,
      -(this.height / 2) + this.padding + this.cornerRadius,
    )
    shape.quadraticCurveTo(
      this.width / 2 - this.padding,
      -(this.height / 2) + this.padding,
      this.width / 2 - this.padding - this.cornerRadius,
      -(this.height / 2) + this.padding,
    )
    shape.lineTo(
      -(this.width / 2) + this.padding + this.cornerRadius,
      -(this.height / 2) + this.padding,
    )
    shape.quadraticCurveTo(
      -(this.width / 2) + this.padding,
      -(this.height / 2) + this.padding,
      -(this.width / 2) + this.padding,
      -(this.height / 2) + this.padding + this.cornerRadius,
    )
    shape.lineTo(
      -(this.width / 2) + this.padding,
      this.height / 2 - this.padding - this.cornerRadius,
    )
    shape.quadraticCurveTo(
      -(this.width / 2) + this.padding,
      this.height / 2 - this.padding,
      -(this.width / 2) + this.padding + this.cornerRadius,
      this.height / 2 - this.padding,
    )
    return shape
  }

  updateShape(width: number, height: number) {
    this.width = width
    this.height = height
    this.geometry?.dispose()
    this.material?.dispose()
    if (!this.mesh) return
    this.remove(this.mesh)
    this.createMesh()
  }
}
