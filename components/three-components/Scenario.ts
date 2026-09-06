import {
  Scene,
  WebGLRenderer,
  WebGLRenderTarget,
  Color,
  PerspectiveCamera,
  HalfFloatType,
  NoToneMapping,
  SRGBColorSpace,
} from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import type { Pass } from 'three/addons/postprocessing/Pass.js'
import { viewport } from './Viewport'

/**
 * A scene, a camera and a renderer.
 *
 * The camera math is the crux of the DOM↔WebGL mapping: with `perspective`
 * world units between the camera and z=0 and a vertical fov that exactly
 * spans the viewport height at that distance, one world unit equals one CSS
 * pixel at z=0, so meshes can be positioned straight from
 * `getBoundingClientRect()`.
 *
 * Nothing in the scene is lit yet: every material is unlit and the renderer
 * does no tone mapping. Lights, an environment map, glass and blur all hang
 * off the two hooks below — `scene` for lights and `environment`, and
 * `enablePostProcessing()` for screen-space passes — without touching the
 * DOM mapping.
 */
/**
 * World units between the camera and z=0. A mesh placed off the z=0 plane has
 * to scale its position and size by `(PERSPECTIVE + depth) / PERSPECTIVE` to
 * keep its screen footprint; see GlowPlate.
 */
export const PERSPECTIVE = 1000

export default class Scenario {
  scene: Scene
  camera: PerspectiveCamera
  perspective: number
  fov: number
  aspectRatio: number
  renderer: WebGLRenderer
  composer: EffectComposer | null = null

  width: number
  height: number

  constructor(canvas: HTMLCanvasElement) {
    // The canvas's own size (Viewport.ts), set by the canvas component before
    // this is constructed; the window's as a fallback
    this.width = viewport.width || window.innerWidth
    this.height = viewport.height || window.innerHeight

    this.scene = new Scene()
    this.perspective = PERSPECTIVE
    this.fov =
      (180 * (2 * Math.atan(this.height / 2 / this.perspective))) / Math.PI
    this.aspectRatio = this.width / this.height
    this.camera = new PerspectiveCamera(this.fov, this.aspectRatio, 1, 2000)
    this.camera.position.set(0, 0, this.perspective)

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
    })
    /*
     * Stated explicitly because both decide how the image shader's
     * `colorspace_fragment` behaves. Tone mapping stays off until there is
     * something lit to map; when it goes on, remember OutputPass applies it to
     * the whole frame, photographs included.
     */
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = NoToneMapping
    this.renderer.setClearColor(new Color(0xffffff), 0)
    this.renderer.setSize(this.width, this.height)
    this.updatePixelRatio()
  }

  /**
   * Routes drawing through an EffectComposer: RenderPass, then `passes`. There
   * is no OutputPass, on purpose: the last of `passes` has to encode for the
   * screen itself, because the canvas is transparent and the target is
   * premultiplied, which OutputPass would encode as if it were not (see
   * HalationPass). Tone mapping, when it comes, goes in that last pass too.
   * It costs a full-screen render target per frame, so it is only on because
   * a pass needs it. The target is multisampled so the canvas' own
   * antialiasing is not lost on the way.
   */
  enablePostProcessing(passes: Pass[] = []) {
    this.disablePostProcessing()
    const target = new WebGLRenderTarget(this.width, this.height, {
      samples: 4,
      type: HalfFloatType,
    })
    const composer = new EffectComposer(this.renderer, target)
    composer.addPass(new RenderPass(this.scene, this.camera))
    for (const pass of passes) composer.addPass(pass)
    composer.setPixelRatio(this.renderer.getPixelRatio())
    composer.setSize(this.width, this.height)
    this.composer = composer
  }

  disablePostProcessing() {
    this.composer?.dispose()
    this.composer = null
  }

  /**
   * Applies the device pixel ratio, capped to keep the fragment cost sane on
   * high density displays and lower still on touch devices
   */
  private updatePixelRatio() {
    const maxRatio = window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2
    // `?dpr=1` on the address bar overrides the cap, for testing a device
    // that cannot be profiled from here (the perf overlay, `?perf`)
    const override = Number(
      new URLSearchParams(window.location.search).get('dpr'),
    )
    const ratio =
      override > 0 ? override : Math.min(window.devicePixelRatio, maxRatio)
    this.renderer.setPixelRatio(ratio)
    this.composer?.setPixelRatio(ratio)
  }

  updateCameraSize(width: number, height: number) {
    this.aspectRatio = width / height
    this.fov = (180 * (2 * Math.atan(height / 2 / this.perspective))) / Math.PI
    this.camera.aspect = this.aspectRatio
    this.camera.fov = this.fov
    this.camera.updateProjectionMatrix()
  }

  updateRendererSize(width: number, height: number) {
    this.width = width
    this.height = height
    this.renderer.setSize(width, height)
    this.updatePixelRatio()
    this.composer?.setSize(width, height)
  }

  render() {
    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.disablePostProcessing()
    this.renderer.dispose()
  }
}
