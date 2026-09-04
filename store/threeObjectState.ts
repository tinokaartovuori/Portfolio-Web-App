import { defineStore } from 'pinia'
import { ref } from 'vue'

interface ThreeElementEntry {
  element: HTMLElement
  object: string
}

/**
 * Registry of DOM elements that want a counterpart in the WebGL scene.
 *
 * ElementTracker and ThreeImage register into it on mount and drop out of it
 * again on unmount, keyed by their `threeReference`; ThreeScrollCanvas rebuilds
 * the scene when it changes.
 */
export const useThreeObjectStateStore = defineStore(
  'three-object-state-store',
  () => {
    const threeElementTracker = ref<Record<string, ThreeElementEntry>>({})
    const threeImageTracker = ref<Record<string, HTMLImageElement>>({})

    /**
     * One `threeReference` maps to one mesh, so a duplicate silently replaces
     * the entry that was there and leaves the losing element without a
     * counterpart. Cheap to hit with generated ids, and near-impossible to
     * diagnose from the symptom, so say so while developing — but never throw:
     * a duplicate id must not take the whole page down in production.
     */
    function warnOnDuplicate(id: string) {
      if (!import.meta.dev) return
      if (
        !(id in threeElementTracker.value) &&
        !(id in threeImageTracker.value)
      )
        return

      console.warn(
        `[threeObjectState] duplicate threeReference "${id}": the previous element loses its WebGL counterpart. threeReference must be unique across ElementTracker and ThreeImage.`,
      )
    }

    function addThreeElement(id: string, element: HTMLElement, object: string) {
      warnOnDuplicate(id)
      threeElementTracker.value[id] = { element, object }
    }

    function addThreeImage(id: string, element: HTMLImageElement) {
      warnOnDuplicate(id)
      threeImageTracker.value[id] = element
    }

    /**
     * Pass `element` when the caller owns a specific node: unmount order is not
     * guaranteed, so a component that lost its id to a duplicate would
     * otherwise delete the entry belonging to whoever took it over.
     */
    function remove(threeReference: string, element?: HTMLElement) {
      const entry = threeElementTracker.value[threeReference]
      if (entry && (!element || entry.element === element))
        delete threeElementTracker.value[threeReference]

      const image = threeImageTracker.value[threeReference]
      if (image && (!element || image === element))
        delete threeImageTracker.value[threeReference]
    }

    function reset() {
      threeElementTracker.value = {}
      threeImageTracker.value = {}
    }

    return {
      threeElementTracker,
      threeImageTracker,
      addThreeElement,
      addThreeImage,
      remove,
      reset,
    }
  },
)
