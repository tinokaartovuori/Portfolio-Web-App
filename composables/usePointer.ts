/**
 * Plain, non-reactive pointer state, written from the DOM and read by the
 * WebGL layer every frame — the same arrangement as `scrollFrame`.
 */
export const pointerFrame = {
  /** Viewport position in CSS pixels. */
  x: 0,
  y: 0,
  /**
   * True only for a fine pointer that can hover (a mouse or trackpad). A
   * finger produces pointer events too, but only while it is on the glass, so
   * hover effects would flash on every scroll and never settle — they are
   * gated on this instead.
   */
  hover: false,
  /** True once a hover-capable pointer has moved over the page at all. */
  active: false,
}

export function createPointerTracker() {
  const hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)')

  const applyCapability = () => {
    pointerFrame.hover = hoverCapable.matches
    if (!pointerFrame.hover) pointerFrame.active = false
  }
  applyCapability()

  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
    pointerFrame.x = event.clientX
    pointerFrame.y = event.clientY
    pointerFrame.active = pointerFrame.hover
  }

  // The pointer left the window: nothing should stay lit under it
  const onLeave = () => {
    pointerFrame.active = false
  }

  window.addEventListener('pointermove', onMove, { passive: true })
  document.documentElement.addEventListener('pointerleave', onLeave)
  hoverCapable.addEventListener('change', applyCapability)

  return () => {
    window.removeEventListener('pointermove', onMove)
    document.documentElement.removeEventListener('pointerleave', onLeave)
    hoverCapable.removeEventListener('change', applyCapability)
    pointerFrame.active = false
  }
}
