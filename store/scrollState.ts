// store/filters.js
import { defineStore } from 'pinia'

export const useScrollStateStore = defineStore({
  id: 'scroll-state-store',
  state: () => {
    return {
      scrollY: 0 as number,
      scrollYSpeed: 0 as number,
      scrollYMax: 0 as number,
    }
  },
})
