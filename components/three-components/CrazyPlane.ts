import {
  Object3D,
  Mesh,
  Vector2,
  PlaneGeometry,
  MeshBasicMaterial,
} from 'three'

// NOTE: This class is in work in progress
export class CrazyPlane extends Object3D {
  // This is the object that we want to sync the position of
  mesh: Mesh
  geometry: PlaneGeometry
  material: MeshBasicMaterial

  element: HTMLImageElement
  sizes: Vector2
  offset: Vector2

  uniforms: any

  constructor(element: HTMLImageElement) {
    super()
    this.mesh = new Mesh()

    this.element = element
    this.sizes = new Vector2(0, 0)
    this.offset = new Vector2(0, 0)
    this.uniforms = {}
    this.createMesh()
  }

  getDimensions() {
    const { width, height, top, left } = this.element.getBoundingClientRect()
    this.sizes.set(width, height)
    this.offset.set(
      left - window.innerWidth / 2 + width / 2,
      -top + window.innerHeight / 2 - height / 2,
    )
  }

  createMesh() {
    this.getDimensions()
    this.geometry = new PlaneGeometry(1, 1, 30, 30)

    this.uniforms = {
      uOffset: { value: new Vector2(0, 0) },
      uAlpha: { value: 1 },
      uYPosition: { value: 0 },
      uMouse: { value: new Vector2(0, 0) },
    }

    this.material = new MeshBasicMaterial({ color: 0xff0000 })

    this.mesh.geometry = this.geometry
    this.mesh.material = this.material
    this.mesh.scale.set(this.sizes.x, this.sizes.y, 1)
    this.add(this.mesh)
  }

  update(scrollYSpeed: number = 0) {
    this.getDimensions()
    this.mesh.position.x = this.offset.x
    this.mesh.position.y = this.offset.y
    this.mesh.scale.set(this.sizes.x, this.sizes.y, 1)
    this.uniforms.uYPosition.value =
      ((this.offset.y - this.sizes.y / 2) /
        (window.innerHeight + this.sizes.y * 2)) *
      2
    this.uniforms.uOffset.value.set(this.offset.x * 0.0, -scrollYSpeed * 0.004)
  }

  updatePosition() {
    this.getDimensions()
    this.mesh.position.x = this.offset.x
    this.mesh.position.y = this.offset.y
  }

  updateAspectRatio() {
    this.mesh.scale.set(this.sizes.x, this.sizes.y, 1)
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}
