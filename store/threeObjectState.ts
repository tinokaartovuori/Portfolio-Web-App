// store/filters.js
import { defineStore } from 'pinia'

interface ThreeElementEntry {
  element: HTMLElement
  object: string
}

export const useThreeObjectStateStore = defineStore({
  id: 'three-object-state-store',
  state: () => {
    return {
      threeElementTracker: {} as Record<string, ThreeElementEntry>,
      threeImageTracker: {} as Record<string, HTMLImageElement>,
    }
  },
  actions: {
    addThreeElement(id: string, element: HTMLElement, object: string) {
      this.threeElementTracker[id] = {
        element: element,
        object: object,
      }
    },
    addThreeImage(id: string, element: HTMLImageElement) {
      this.threeImageTracker[id] = element
    },
    remove(threeReference: string) {
      delete this.threeElementTracker[threeReference]
      delete this.threeImageTracker[threeReference]
    },
    reset() {
      this.threeElementTracker = {}
      this.threeImageTracker = {}
    },
  },
})
