import { Mesh, Scene } from 'three'
import { IntroRectangle } from './IntroRectangle'
import type { FrameContext } from './FrameContext'

/**
 * A mesh pinned to a DOM element. It owns GPU resources of its own, so whoever
 * drops it from the scene has to hand them back.
 */
export interface DomPinnedMesh extends Mesh {
  dispose(): void
}

/**
 * The full lifecycle ElementManager drives on a tracked element. Declared as an
 * interface rather than a shared base class because the classes implementing it
 * live in modules this one imports: a base class here would close an import
 * cycle and leave the subclasses extending an uninitialised binding.
 */
export interface TrackedObject3D extends DomPinnedMesh {
  /** Full re-measure and rebuild, with every effect at rest. */
  update(): void
  /** Per-frame placement and physics. */
  updatePosition(ctx: FrameContext): void
  updateAspectRatio(): void
}

type TrackedObject3DConstructor = new (element: HTMLElement) => TrackedObject3D

/**
 * Every value an `<ElementTracker object="…">` prop may name. Adding an element
 * type is one entry here, and `satisfies` turns a class that has drifted from
 * the lifecycle into a compile error on this line rather than a method that
 * throws on the first frame.
 */
const OBJECT_TYPES = {
  IntroRectangle,
} satisfies Record<string, TrackedObject3DConstructor>

export type TrackedObjectName = keyof typeof OBJECT_TYPES

// The prop is a free-form string, so the lookup has to admit a miss
const OBJECT_TYPE_LOOKUP: Record<
  string,
  TrackedObject3DConstructor | undefined
> = OBJECT_TYPES

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
    for (const [key, { element, object }] of Object.entries(elements)) {
      const ObjectType = OBJECT_TYPE_LOOKUP[object]

      if (!ObjectType) {
        // A typo in the prop renders nothing at all, with no error anywhere —
        // miserable to diagnose from the symptom, so name it while developing
        if (import.meta.dev) {
          console.warn(
            `[ElementManager] unknown object type "${object}" on threeReference "${key}": no mesh will be created. Known types: ${Object.keys(
              OBJECT_TYPES,
            ).join(', ')}.`,
          )
        }
        continue
      }

      const trackedObject = new ObjectType(element)
      this.elements.push(trackedObject)
      this.scene.add(trackedObject)
      trackedObject.update()
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

  updateElementPositions(ctx: FrameContext) {
    this.elements.forEach((element) => element.updatePosition(ctx))
  }
}
