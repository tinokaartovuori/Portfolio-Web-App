import { Mesh } from 'three'

// NOTE: This class is in work in progress
export default class ThreeDomSyncer {
  // This is the object that we want to sync the position of

  mesh: Mesh
  element: HTMLElement
  type: 'centered' | 'centered-fit'

  constructor(
    type: 'centered' | 'centered-fit',
    mesh: Mesh,
    element: HTMLElement,
  ) {
    this.mesh = mesh
    this.element = element
    this.type = type

    this.sync()
  }

  sync() {
    this.updatePosition()
    if (this.type === 'centered-fit') {
      this.updateFit()
    }
  }

  updatePosition() {
    const { x, y } = this.element.getBoundingClientRect()
    this.mesh.position.x =
      -window.innerWidth / 2 +
      this.element.clientWidth / 2 +
      this.element.offsetLeft
    this.mesh.position.y =
      -y - this.element.offsetHeight / 2 + window.innerHeight / 2
  }

  updateFit() {
    const { width, height } = this.element.getBoundingClientRect()
    this.mesh.scale.x = width / 2
    this.mesh.scale.y = height / 2
  }
}
