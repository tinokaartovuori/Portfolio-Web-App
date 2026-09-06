/**
 * The size of the canvas the scene draws into, in CSS px, set by the canvas
 * component and read by every class that pins a mesh to a DOM box. It is
 * the canvas's own size, not `window.innerHeight`: on a phone the browser's
 * address bar comes and goes with the scroll, and the window height with it,
 * while the canvas is sized to the largest viewport (`100lvh`) and does not
 * change. Measured against the window instead, every mesh was off its box
 * and the drawing buffer was stretched until a debounced resize caught up,
 * a jolt through the whole scene each time the bar toggled. The DOM rects
 * the meshes are measured from are relative to the viewport's top, which is
 * where the canvas's top is, so the mapping holds however tall the canvas.
 */
export const viewport = {
  width: 0,
  height: 0,
}
