// store/filters.js
import { defineStore } from 'pinia'

export const useAppStateStore = defineStore({
  id: 'app-state-store',
  state: () => {
    // Here we could also store the window size
    return {
      scrollY: 0 as number,
      scrollYMax: 0 as number,
    }
  },
})
