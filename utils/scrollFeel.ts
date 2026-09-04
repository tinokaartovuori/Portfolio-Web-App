import { damp } from '~/composables/useFrameLoop'

export interface ScrollFeelConfig {
  /** Decay rate per second of the velocity smoothing. */
  velocitySmoothing: number
  /** Velocity at which `drive` reaches ~76% of its peak. */
  velocityScale: number
  /** Decay rate per second of the energy smoothing; slower than the velocity. */
  energySmoothing: number
}

/**
 * How hard the page is moving, as every scroll-driven effect wants to know it.
 *
 * Three numbers, derived in order every frame: the raw scroll velocity is
 * smoothed per second (so a wheel notch reads as one swell, not a shove),
 * soft-saturated with tanh into a signed `drive` in [-1, 1] (proportional at
 * normal speeds, capped on a hard flick), and its magnitude smoothed again,
 * more slowly, into `energy` — so a page-wide effect swells and relaxes as one
 * motion instead of pulsing with each notch. Extracted from WavyImage so the
 * light field, the glow plates and the marquee share one definition of "fast".
 */
export class ScrollFeel {
  /** Smoothed scroll velocity, px/s, signed. */
  velocity = 0
  /** tanh(velocity / scale): -1..1. */
  drive = 0
  /** Smoothed |drive|: 0..1. */
  energy = 0

  constructor(private config: ScrollFeelConfig) {}

  update(rawVelocity: number, dt: number) {
    const { velocitySmoothing, velocityScale, energySmoothing } = this.config
    this.velocity = damp(this.velocity, rawVelocity, velocitySmoothing, dt)
    this.drive = Math.tanh(this.velocity / velocityScale)
    this.energy = damp(this.energy, Math.abs(this.drive), energySmoothing, dt)
  }

  /** Back to rest, e.g. after a resize where the previous frames mean nothing. */
  reset() {
    this.velocity = 0
    this.drive = 0
    this.energy = 0
  }
}
