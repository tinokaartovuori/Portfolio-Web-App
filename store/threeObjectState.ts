import { defineStore } from 'pinia'
import { ref } from 'vue'

interface ThreeElementEntry {
  element: HTMLElement
  object: string
}

/**
 * Registry of DOM elements that want a counterpart in the WebGL scene.
 *
 * ElementTracker and ThreeImage register into it on mount, keyed by their
 * `threeReference`, and ThreeScrollCanvas rebuilds the scene when it changes.
 */
export const useThreeObjectStateStore = defineStore(
  'three-object-state-store',
  () => {
    const threeElementTracker = ref<Record<string, ThreeElementEntry>>({})
    const threeImageTracker = ref<Record<string, HTMLImageElement>>({})

    function addThreeElement(id: string, element: HTMLElement, object: string) {
      threeElementTracker.value[id] = { element, object }
    }

    function addThreeImage(id: string, element: HTMLImageElement) {
      threeImageTracker.value[id] = element
    }

    function remove(threeReference: string) {
      delete threeElementTracker.value[threeReference]
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
