declare module '#app' {
  interface PageMeta {
    /**
     * `false` on a page without a hero, so the bars render their scrolled
     * state (veil, compact) from the server instead of fading into it after
     * mount. See Bar.vue.
     */
    hero?: boolean
  }
}

export {}
