import { motion } from '~/motion.config'
import { viewport } from './Viewport'

/**
 * The site's grain, for every fragment shader that draws it (PageGrain, the
 * photographs, the light fields' plates): one hash of a position on the
 * page, so two surfaces that meet — a plate and the page around it — show
 * one continuous grain across the seam, and only the colour changes.
 *
 * `grainAt` takes the fragment's position in device px (the page grain has
 * it from `gl_FragCoord` and the canvas's place on screen; a mesh from its
 * box's position and its own UV, so the grain rides with the mesh when it
 * leaves its box), the cell size in whole device px and the roll step.
 * `grainOver` mixes the grey over a linear colour in sRGB, as a layer over
 * the page would be, whichever space the target is in. Prepended to the
 * shader source; the sRGB transfer functions are three's, which it prepends
 * to every fragment shader.
 */
export const grainShader = /* glsl */ `
  // Per-pixel hash without a sine, which shows its period on some GPUs
  float grainHash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float grainAt(vec2 docPx, float cell, float roll) {
    return grainHash(floor(docPx / cell) + roll * 17.0);
  }

  vec3 grainOver(vec3 col, float grey, float amount) {
    vec3 srgb = sRGBTransferOETF(vec4(col, 1.0)).rgb;
    srgb = mix(srgb, vec3(grey), amount);
    return sRGBTransferEOTF(vec4(srgb, 1.0)).rgb;
  }
`

/**
 * One cell in whole device px, for the pixel ratio the scene draws at: the
 * configured CSS size, finer on a coarse pointer (see `motion.grain`).
 */
export const grainCell = (ratio: number) => {
  const { cell, cellCoarse } = motion.grain
  return Math.max(1, Math.round((viewport.coarse ? cellCoarse : cell) * ratio))
}
