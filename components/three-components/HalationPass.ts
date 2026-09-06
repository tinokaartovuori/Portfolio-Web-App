import {
  Color,
  HalfFloatType,
  LinearFilter,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
} from 'three'
import type { Camera, Scene, Texture, WebGLRenderer } from 'three'
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import { motion } from '~/motion.config'

const config = motion.halation

/**
 * The layer a mesh enables to be a source of halation. Only the photographs
 * do: the light fields are bright too, and bleeding them turned the hero
 * into a different, louder hero.
 */
export const HALATION_LAYER = 1

/**
 * Halation: the highlights of the photographs bleed outward in the accent
 * colour, the way light that has passed through a film base and come back
 * off the pressure plate haloes the bright parts of a frame. Screen-space,
 * because a bleed needs a neighbourhood to bleed into and a single mesh's
 * shader has none.
 *
 * Three steps: the meshes on `HALATION_LAYER` are drawn again on their own
 * at `1 / scale` resolution (a few quads, so nearly free), the pixels of
 * that above `threshold` (linear luminance, with a soft knee) are kept,
 * blurred with a separable 9-tap gaussian `iterations` times, and added back
 * over the scene tinted and scaled by `strength`. The canvas is transparent
 * and premultiplied, so the halo carries its own alpha: over the page it
 * reads as a glow, not a smear of white.
 *
 * `strength` and `tint` are public and set by the owner every frame, so the
 * scroll drives the first and the theme the second; the pass itself holds
 * no state that has to agree with the clock.
 *
 * It is also the composer's last pass and does the OutputPass's job itself,
 * because the standard one gets a transparent canvas wrong. Everything in the
 * composer's target was blended over a clear of (0, 0, 0, 0), so its colour
 * is premultiplied by its alpha; OutputPass encodes that colour to sRGB as if
 * it were not, and a faint particle at alpha 0.15 comes out two to three
 * times too bright. This pass un-premultiplies, encodes, and premultiplies
 * again, which is what the browser expects from the canvas. Tone mapping,
 * when it comes, goes in the same place.
 */
export default class HalationPass extends Pass {
  /** How much halo is added: 0 none, 1 the full blurred highlight. */
  strength = 0
  /** The halo's colour, in the working (linear) colour space. */
  tint = new Color(motion.palette.accent[1])

  private images: WebGLRenderTarget
  private bright: WebGLRenderTarget
  private ping: WebGLRenderTarget
  private pong: WebGLRenderTarget
  private quad: FullScreenQuad

  // Typed up front, so a uniform is a property rather than a lookup that
  // might miss
  private brightUniforms = {
    tImages: { value: null as Texture | null },
    uThreshold: { value: config.threshold },
    uKnee: { value: config.knee },
    uCurve: { value: config.curve },
  }
  private blurUniforms = {
    tDiffuse: { value: null as Texture | null },
    uStep: { value: new Vector2() },
  }
  private compositeUniforms = {
    tDiffuse: { value: null as Texture | null },
    tHalo: { value: null as Texture | null },
    uTint: { value: this.tint },
    uStrength: { value: 0 },
  }
  private brightMaterial: ShaderMaterial
  private blurMaterial: ShaderMaterial
  private compositeMaterial: ShaderMaterial

  /** The blur's tap spacing in UV of the halo buffers, set on resize. */
  private step = new Vector2()

  constructor(
    private scene: Scene,
    private camera: Camera,
  ) {
    super()

    const targetOptions = {
      type: HalfFloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
    }
    this.images = new WebGLRenderTarget(1, 1, {
      ...targetOptions,
      depthBuffer: true,
    })
    this.bright = new WebGLRenderTarget(1, 1, targetOptions)
    this.ping = new WebGLRenderTarget(1, 1, targetOptions)
    this.pong = new WebGLRenderTarget(1, 1, targetOptions)

    const common = { vertexShader, depthTest: false, depthWrite: false }
    this.brightMaterial = new ShaderMaterial({
      ...common,
      uniforms: this.brightUniforms,
      fragmentShader: brightFragment,
    })
    this.blurMaterial = new ShaderMaterial({
      ...common,
      uniforms: this.blurUniforms,
      fragmentShader: blurFragment,
    })
    this.compositeMaterial = new ShaderMaterial({
      ...common,
      uniforms: this.compositeUniforms,
      fragmentShader: compositeFragment,
    })

    this.quad = new FullScreenQuad(this.brightMaterial)
  }

  /** Called by the composer with the drawing-buffer size (pixel ratio applied). */
  override setSize(width: number, height: number) {
    const w = Math.max(1, Math.round(width / config.scale))
    const h = Math.max(1, Math.round(height / config.scale))
    this.images.setSize(w, h)
    this.bright.setSize(w, h)
    this.ping.setSize(w, h)
    this.pong.setSize(w, h)
    this.step.set(config.radius / w, config.radius / h)
  }

  override render(
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget,
  ) {
    // 1. The photographs alone, small, then their highlights
    this.camera.layers.set(HALATION_LAYER)
    renderer.setRenderTarget(this.images)
    renderer.clear()
    renderer.render(this.scene, this.camera)
    this.camera.layers.set(0)

    this.brightUniforms.tImages.value = this.images.texture
    this.quad.material = this.brightMaterial
    renderer.setRenderTarget(this.bright)
    this.quad.render(renderer)

    // 2. Blurred, across then down, as many times as the config asks
    const blur = this.blurUniforms
    this.quad.material = this.blurMaterial
    let source = this.bright
    for (let i = 0; i < config.iterations; i++) {
      blur.tDiffuse.value = source.texture
      blur.uStep.value.set(this.step.x, 0)
      renderer.setRenderTarget(this.ping)
      this.quad.render(renderer)

      blur.tDiffuse.value = this.ping.texture
      blur.uStep.value.set(0, this.step.y)
      renderer.setRenderTarget(this.pong)
      this.quad.render(renderer)
      source = this.pong
    }

    // 3. Added back over the scene, tinted
    const composite = this.compositeUniforms
    composite.tDiffuse.value = readBuffer.texture
    composite.tHalo.value = source.texture
    composite.uStrength.value = this.strength
    composite.uTint.value = this.tint
    this.quad.material = this.compositeMaterial
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer)
    this.quad.render(renderer)
  }

  override dispose() {
    this.images.dispose()
    this.bright.dispose()
    this.ping.dispose()
    this.pong.dispose()
    this.brightMaterial.dispose()
    this.blurMaterial.dispose()
    this.compositeMaterial.dispose()
    this.quad.dispose()
  }
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * What is bright enough to bleed, from the photographs' own render. The
 * transparent page around them is cleared to premultiplied black, so it never
 * counts as a highlight. The knee softens the cut so a gradient into a bright
 * area does not halo along a hard line, and the curve compresses what is
 * left so the halo belongs to the whole photograph, not its whites alone.
 */
const brightFragment = /* glsl */ `
  uniform sampler2D tImages;
  uniform float uThreshold;
  uniform float uKnee;
  uniform float uCurve;
  varying vec2 vUv;

  void main() {
    // The target's colour is premultiplied, so a faint or transparent pixel
    // already weighs as little as it should
    vec4 image = texture2D(tImages, vUv);
    float luma = dot(image.rgb, vec3(0.2126, 0.7152, 0.0722));
    float soft = clamp(luma - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 1e-4);
    // Compressed, so the mid-tones bleed nearer the whites than a linear
    // excess would have them
    float bleed = pow(max(soft, luma - uThreshold), uCurve);
    gl_FragColor = vec4(vec3(bleed), 1.0);
  }
`

/** One direction of a separable gaussian; `uStep` is the tap spacing in UV. */
const blurFragment = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uStep;
  varying vec2 vUv;

  float tap(float offset) {
    return texture2D(tDiffuse, vUv + uStep * offset).r;
  }

  void main() {
    float sum = tap(0.0) * 0.227027;
    sum += (tap(1.0) + tap(-1.0)) * 0.1945946;
    sum += (tap(2.0) + tap(-2.0)) * 0.1216216;
    sum += (tap(3.0) + tap(-3.0)) * 0.054054;
    sum += (tap(4.0) + tap(-4.0)) * 0.016216;
    gl_FragColor = vec4(vec3(sum), 1.0);
  }
`

/**
 * The scene with the tinted halo added, encoded for the screen. Where the
 * halo reaches past a mesh onto the transparent page it carries alpha of its
 * own, so the browser composites it as light over the page colour rather than
 * as a lightened black rectangle. The encode runs on un-premultiplied colour
 * and the result is premultiplied again: the canvas is premultiplied, and
 * encoding a premultiplied value brightens everything translucent.
 */
const compositeFragment = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform sampler2D tHalo;
  uniform vec3 uTint;
  uniform float uStrength;
  varying vec2 vUv;

  void main() {
    vec4 scene = texture2D(tDiffuse, vUv);
    float halo = texture2D(tHalo, vUv).r * uStrength;
    vec3 rgb = scene.rgb + uTint * halo;
    float a = min(1.0, scene.a + halo);
    gl_FragColor = vec4(a > 0.0 ? rgb / a : vec3(0.0), a);
    #include <colorspace_fragment>
    gl_FragColor.rgb *= gl_FragColor.a;
  }
`
