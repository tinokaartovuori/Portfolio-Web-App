// store/filters.js
import { defineStore } from 'pinia'

export const useAppStateStore = defineStore({
  id: 'app-state-store',
  state: () => {
    return {
      scrollY: 0,
    }
  },
  actions: {},
  getters: {
    getScrollY: (state) => state.scrollY,
  },
})
