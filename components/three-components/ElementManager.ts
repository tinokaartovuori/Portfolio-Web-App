import { Object3D, Scene } from 'three'
import { IntroRectangle } from './IntroRectangle'
import { CrazyPlane } from './CrazyPlane'

export default class ElementManager {
  scene: Scene
  elements: Object3D[]

  constructor(scene: Scene) {
    this.elements = []
    this.scene = scene
  }

  loadElements(
    elements: Record<string, { element: HTMLElement; object: string }>,
  ) {
    for (const [key, object] of Object.entries(elements)) {
      const objectType = object.object
      const objectElement = object.element

      if (objectType === 'IntroRectangle') {
        const introRectangle = new IntroRectangle(
          objectElement as HTMLDivElement,
        )
        this.elements.push(introRectangle)
        this.scene.add(introRectangle)
        introRectangle.update()
        continue
      }

      if (objectType === 'CrazyPlane') {
        const crazyPlane = new CrazyPlane(objectElement as HTMLImageElement)
        this.elements.push(crazyPlane)
        this.scene.add(crazyPlane)
        crazyPlane.update()
        continue
      }

      // Here we can add more element types
    }
  }

  removeElements() {
    this.elements.forEach((element) => {
      this.scene.remove(element)
      element.dispose()
    })
    this.elements = []
  }

  updateElements(scrollYSpeed: number = 0) {
    this.elements.forEach((element) => element.update())
  }

  updateElementAspectRatios() {
    this.elements.forEach((element) => element.updateAspectRatio())
  }

  updateElementPositions() {
    this.elements.forEach((element) => element.updatePosition())
  }
}
