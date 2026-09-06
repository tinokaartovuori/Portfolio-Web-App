import {
  Mesh,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from 'three'
import { motion } from '~/motion.config'
import { ease } from '~/composables/useReveal'
import { PERSPECTIVE } from './Scenario'
import { grainShader, grainCell } from './grain'
import type { FrameContext } from './FrameContext'
import { viewport } from './Viewport'

const config = motion.noise
const { grain } = motion

/**
 * How far behind the page the plane sits, world units: behind the dust, so
 * the dust draws over it, and far enough that nothing on the page can pass
 * behind it. The footprint is scaled by the perspective to keep the canvas
 * covered.
 */
const DEPTH = 300

type PageGrainUniforms = {
  /** The drawing buffer, device px. */
  uResolution: { value: Vector2 }
  /** What to add to a pixel's row from the canvas's top for its place in
   * the grain's own space, device px: the canvas's viewport top plus the
   * parallax share of the scroll. */
  uOffset: { value: number }
  /** One cell, device px (whole, so the cells sit on the pixel grid). */
  uCell: { value: number }
  /** The roll: a new pattern each step. */
  uRoll: { value: number }
  uAlpha: { value: number }
}

const vertexShader = /* glsl */ `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec2 uResolution;
  uniform float uOffset;
  uniform float uCell;
  uniform float uRoll;
  uniform float uAlpha;

  ${grainShader}

  void main() {
    // This pixel's place in the grain: its row from the canvas's top, plus
    // where that top is on screen and how far the grain has scrolled
    vec2 at = vec2(gl_FragCoord.x, uOffset + (uResolution.y - gl_FragCoord.y));
    float g = grainAt(at, uCell, uRoll);

    // A uniform grey in sRGB, as a layer over the page would be: decoded
    // here, so the encode below (or the composer's) gives that back
    gl_FragColor = vec4(sRGBTransferEOTF(vec4(vec3(g), 1.0)).rgb, uAlpha);

    #include <colorspace_fragment>
  }
`

/**
 * The grain over the page: the site's grain (`motion.grain`) drawn behind
 * everything in the scene — under the text, around the photographs and the
 * light fields' plates, which carry the same grain themselves — and pinned
 * to the document, so it scrolls with the page and the rubber band like the
 * text does — by `noise.parallax` of it, so it sits behind the page, as far
 * back as the far dust, and the page is a window onto it.
 *
 * One plane covering the canvas, far behind the page. The pattern is a hash
 * of each pixel's place in the grain's own space: its viewport position
 * (the canvas's top, `viewport.top`, plus its row) plus the parallax share
 * of the scroll as seen (the band included), in whole device px. The
 * plates hash the same space (LightField), so the pattern runs on across a
 * plate's edge at every scroll position. Between two JS frames the
 * compositor carries the canvas with the page, a frame's worth further
 * than the grain should go, which the next frame takes back; at this depth
 * that is under a pixel. Re-rolled at `noise.rate`, slower than the grain
 * in the photographs, because it sits under the text; still under reduced
 * motion, where it still follows the scroll. Fades in on the scene's
 * reveal like the dust.
 */
export default class PageGrain {
  private scene: Scene
  private renderer: WebGLRenderer
  private mesh: Mesh<PlaneGeometry, ShaderMaterial>
  private uniforms: PageGrainUniforms
  private size = new Vector2()

  constructor(scene: Scene, renderer: WebGLRenderer) {
    this.scene = scene
    this.renderer = renderer
    this.uniforms = {
      uResolution: { value: new Vector2(1, 1) },
      uOffset: { value: 0 },
      uCell: { value: 1 },
      uRoll: { value: 0 },
      uAlpha: { value: 0 },
    }
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
    })
    this.mesh = new Mesh(new PlaneGeometry(1, 1), material)
    this.mesh.frustumCulled = false
    // Behind the page and the dust; first of the transparent draws
    this.mesh.position.z = -DEPTH
    this.mesh.renderOrder = -2
    scene.add(this.mesh)
    this.resize()
  }

  update(ctx: FrameContext) {
    const u = this.uniforms
    // The scroll as the content is seen: the band moves it too
    const seen = ctx.scroll.y - ctx.scroll.overscroll
    u.uOffset.value = Math.round(
      (viewport.top + seen * config.parallax) * viewport.ratio,
    )
    u.uRoll.value = ctx.reduced ? 0 : Math.floor(ctx.time * config.rate)
    const { alpha } = grain
    u.uAlpha.value =
      (alpha[0] + (alpha[1] - alpha[0]) * ctx.theme) * ease(ctx.reveal)
  }

  /** The canvas changed size or pixel ratio: cover it again. */
  resize() {
    const scale = (PERSPECTIVE + DEPTH) / PERSPECTIVE
    this.mesh.scale.set(viewport.width * scale, viewport.height * scale, 1)
    this.renderer.getDrawingBufferSize(this.size)
    this.uniforms.uResolution.value.copy(this.size)
    this.uniforms.uCell.value = grainCell(viewport.ratio)
  }

  dispose() {
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}
