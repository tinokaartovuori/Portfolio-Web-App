import type { Vector2 } from 'three'

interface PointerLike {
  x: number
  y: number
  active: boolean
}

/**
 * Where the pointer is over a screen-space box, in UV space (u right, v up,
 * both 0..1), or null when it is outside or there is no hover-capable pointer.
 *
 * `left`/`top` are the box's top-left in CSS pixels *as it is currently drawn*
 * — with any trail or drift the mesh has added — so an effect lands under the
 * cursor and not a few pixels off during a scroll. Writes into `out` and
 * returns it, so a per-frame hover test allocates nothing.
 */
export function cursorUvIn(
  pointer: PointerLike,
  left: number,
  top: number,
  width: number,
  height: number,
  out: Vector2,
): Vector2 | null {
  if (!pointer.active) return null
  if (width === 0 || height === 0) return null

  const u = (pointer.x - left) / width
  const v = 1 - (pointer.y - top) / height
  if (u < 0 || u > 1 || v < 0 || v > 1) return null
  return out.set(u, v)
}
