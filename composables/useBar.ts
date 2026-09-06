import type { ComputedRef, InjectionKey } from 'vue'

/**
 * What a `Bar` tells the controls inside it: whether it has left the hero.
 * The heart reads it to take the accent only once it is over the page.
 */
export const BAR_PAST_HERO: InjectionKey<ComputedRef<boolean>> =
  Symbol('barPastHero')
