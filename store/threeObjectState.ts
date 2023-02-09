// store/filters.js
import { defineStore } from 'pinia'

export const useThreeObjectStateStore = defineStore({
  id: 'three-object-state-store',
  state: () => {
    return {
      threeElementTracker: {} as Record<
        string,
        { element: HTMLElement; object: string }
      >,
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
    reset() {
      this.threeElementTracker = {}
      this.threeImageTracker = {}
    },
  },
})
