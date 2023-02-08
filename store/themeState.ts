// store/filters.js
import { defineStore } from 'pinia'

export const useThemeStateStore = defineStore({
  id: 'theme-state-store',
  state: () => {
    return {
      colorMode: 'dark' as 'dark' | 'light',
    }
  },
})
