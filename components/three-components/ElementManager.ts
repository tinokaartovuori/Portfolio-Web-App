import { Object3D, Scene } from 'three'
import { IntroRectangle } from './IntroRectangle'

/**
 * An Object3D that is pinned to a DOM element and therefore has to expose the
 * full lifecycle that ElementManager drives.
 */
export interface TrackedObject3D extends Object3D {
  update(): void
  updatePosition(): void
  updateAspectRatio(): void
  dispose(): void
}

export default class ElementManager {
  scene: Scene
  elements: TrackedObject3D[]

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

  updateElements() {
    this.elements.forEach((element) => element.update())
  }

  updateElementAspectRatios() {
    this.elements.forEach((element) => element.updateAspectRatio())
  }

  updateElementPositions() {
    this.elements.forEach((element) => element.updatePosition())
  }
}
