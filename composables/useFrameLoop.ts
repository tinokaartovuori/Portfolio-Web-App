import { gsap } from 'gsap'

/**
 * The single clock for everything that moves.
 *
 * Previously three separate loops drove the frame: gsap.ticker rendered the
 * scrollbar, Vue's watcher queue moved the meshes, and a private
 * requestAnimationFrame rendered the WebGL scene. Their relative order was an
 * accident of mount order, so the meshes could be transformed from a scroll
 * value that the renderer had already drawn — a one-frame lag between a DOM
 * element and the mesh pinned to it, which at 1500 px/s is a visible 25px slip.
 *
 * Callbacks here run in a fixed order every frame instead:
 *   scroll    — advance the smooth-scroll integrator, publish the new position
 *   transform — measure/place meshes against the position scroll just produced
 *   render    — draw
 */
export type FrameStage = 'scroll' | 'transform' | 'render'

/** @param dt seconds since the previous frame, clamped. @param time seconds since the loop started. */
export type FrameCallback = (dt: number, time: number) => void

const STAGE_ORDER: FrameStage[] = ['scroll', 'transform', 'render']

/**
 * A long frame (a background tab, a stalled main thread) would otherwise make
 * every exponential decay jump most of the way to its target in one step, which
 * reads as a snap. Clamping to 30fps bounds that.
 */
const MAX_DELTA = 1 / 30

const stages: Record<FrameStage, Set<FrameCallback>> = {
  scroll: new Set(),
  transform: new Set(),
  render: new Set(),
}

let running = false
let elapsed = 0

function tick(_time: number, deltaMs: number) {
  const dt = Math.min(deltaMs / 1000, MAX_DELTA)
  elapsed += dt
  for (const stage of STAGE_ORDER) {
    for (const callback of stages[stage]) callback(dt, elapsed)
  }
}

function sync() {
  const active = STAGE_ORDER.some((stage) => stages[stage].size > 0)
  if (active && !running) {
    running = true
    elapsed = 0
    gsap.ticker.add(tick)
  } else if (!active && running) {
    running = false
    gsap.ticker.remove(tick)
  }
}

/**
 * Registers a per-frame callback. Returns the unregister function; callers in
 * components should invoke it from onUnmounted (or use `useFrame`, which does).
 */
export function onFrame(stage: FrameStage, callback: FrameCallback) {
  stages[stage].add(callback)
  sync()
  return () => {
    stages[stage].delete(callback)
    sync()
  }
}

/** Component-scoped `onFrame`: unregisters itself when the component unmounts. */
export function useFrame(stage: FrameStage, callback: FrameCallback) {
  const stop = onFrame(stage, callback)
  onUnmounted(stop)
  return stop
}

/**
 * Frame-rate independent exponential decay.
 *
 * The `x += (target - x) * k` form every easing in this project used decays per
 * *frame*, so it settled 2.4x faster on a 144Hz display than on a 60Hz one.
 * This decays per second instead. To port an old per-frame k tuned at 60fps:
 * `lambda = -60 * Math.log(1 - k)` — so k=0.2 is lambda≈13.4, k=0.1 is ≈6.3.
 */
export function damp(
  current: number,
  target: number,
  lambda: number,
  dt: number,
) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt))
}
