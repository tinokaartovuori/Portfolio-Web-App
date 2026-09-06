import { ease } from '~/composables/useReveal'

/**
 * A per-element arrival clock: 0 when the element's mesh first has something
 * to show, 1 once its reveal is done. It lives on the DOM element rather than
 * on the mesh because the scene is rebuilt on every registration burst and
 * navigation, and a mesh that replayed its arrival on each rebuild would
 * flash. An element that has arrived stays arrived for as long as it exists.
 */
export interface Arrival {
  t: number
}

const arrivals = new WeakMap<Element, Arrival>()

/** The element's clock, created at 0 the first time it is asked for. */
export function arrivalFor(element: Element): Arrival {
  let arrival = arrivals.get(element)
  if (!arrival) {
    arrival = { t: 0 }
    arrivals.set(element, arrival)
  }
  return arrival
}

/**
 * Advances the clock by `dt` over `duration` seconds (snapped to done under
 * reduced motion) and returns the eased 0..1 value to shape effects by.
 */
export function advance(
  arrival: Arrival,
  dt: number,
  duration: number,
  reduced: boolean,
) {
  if (reduced) arrival.t = 1
  else if (arrival.t < 1) arrival.t = Math.min(1, arrival.t + dt / duration)
  return ease(arrival.t)
}
