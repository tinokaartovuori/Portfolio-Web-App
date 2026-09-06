/**
 * The canvas the scene draws into, in CSS px, set by the canvas component
 * and read by every class that pins a mesh to a DOM box. Its size is the
 * canvas's own, not the window's: on a phone the browser's address bar comes
 * and goes with the scroll, and the window height with it, while the canvas
 * is sized from the largest viewport (`lvh`) and does not change. Measured
 * against the window instead, every mesh was off its box and the drawing
 * buffer was stretched until a debounced resize caught up, a jolt through
 * the whole scene each time the bar toggled. The camera's fov spans this
 * height, so one world unit is still one CSS px at z=0, and a rect's top
 * becomes a world y through `top` below.
 */
export const viewport = {
  width: 0,
  height: 0,
  /**
   * Where the canvas's top edge is in the viewport, in CSS px (0 or negative
   * while the page is scrolled). The canvas lives in the scrolled document
   * so the compositor moves it with the page between JS frames; a DOM rect,
   * which is viewport-relative, becomes canvas-relative by subtracting this.
   */
  top: 0,
  /**
   * Where the canvas's top edge is in the document, in CSS px: the
   * transform the canvas component anchors its host with, a whole number.
   * For what is pinned to the document rather than to a box (the page
   * grain): a canvas pixel's document position is this plus its row.
   */
  docTop: 0,
  /** The pixel ratio the renderer draws at (capped, see Scenario). */
  ratio: 1,
  /** A coarse primary pointer (a phone): the grain is set finer there. */
  coarse: false,
}
