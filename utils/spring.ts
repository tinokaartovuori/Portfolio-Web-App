/**
 * A damped harmonic spring, integrated in the frame loop.
 *
 * `damp()` in useFrameLoop is an exponential decay: it can only approach a
 * target, never overshoot it. Anything that should feel like it has mass — a
 * mesh trailing its DOM box and settling with a small rebound, the page
 * springing back from an edge — needs a second-order system, which is this.
 *
 * Parameters follow the Framer / react-spring convention so values can be
 * borrowed from either: with mass 1, a damping of 2·√stiffness is critically
 * damped, less overshoots, more creeps.
 */
export interface SpringConfig {
  stiffness: number
  damping: number
  mass?: number
  /** Velocity cap, in units per second. A long travel becomes a glide. */
  maxVelocity?: number
}

/**
 * Semi-implicit Euler is stable while the step stays under 2/ω; the frame loop
 * clamps dt at 1/30, so a stiffness up to ~3000 is safe without substepping.
 * Substepping anyway keeps the result identical at 60 and 144Hz, which is the
 * whole point of integrating with dt in the first place.
 */
const MAX_STEP = 1 / 240

export class Spring {
  value: number
  velocity = 0
  target: number
  stiffness: number
  damping: number
  mass: number
  maxVelocity: number

  constructor(config: SpringConfig, initial = 0) {
    this.stiffness = config.stiffness
    this.damping = config.damping
    this.mass = config.mass ?? 1
    this.maxVelocity = config.maxVelocity ?? Infinity
    this.value = initial
    this.target = initial
  }

  /** Advances the spring by `dt` seconds and returns the new value. */
  update(dt: number) {
    let remaining = dt
    while (remaining > 0) {
      const step = Math.min(remaining, MAX_STEP)
      remaining -= step
      const displacement = this.value - this.target
      const acceleration =
        (-this.stiffness * displacement - this.damping * this.velocity) /
        this.mass
      this.velocity += acceleration * step
      if (Math.abs(this.velocity) > this.maxVelocity)
        this.velocity = Math.sign(this.velocity) * this.maxVelocity
      this.value += this.velocity * step
    }
    return this.value
  }

  /** Snaps to `value` with no motion, e.g. after a rebuild or a resize. */
  set(value: number) {
    this.value = value
    this.target = value
    this.velocity = 0
  }

  /** Adds an instantaneous velocity, in units per second. */
  impulse(velocity: number) {
    this.velocity += velocity
  }

  /** True once the spring is close enough to rest to skip work. */
  get settled() {
    return (
      Math.abs(this.value - this.target) < 0.01 &&
      Math.abs(this.velocity) < 0.01
    )
  }
}
