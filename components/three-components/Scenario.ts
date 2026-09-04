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
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import type { Pass } from 'three/addons/postprocessing/Pass.js'

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
    this.width = window.innerWidth
    this.height = window.innerHeight

    this.scene = new Scene()
    this.perspective = 1000
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
   * Routes drawing through an EffectComposer: RenderPass, then `passes`, then
   * an OutputPass that applies tone mapping and encodes to sRGB. Off until a
   * pass needs it — bloom, blur, a glass refraction pass — because it costs a
   * full-screen render target per frame. The target is multisampled so the
   * canvas' own antialiasing is not lost on the way.
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
    composer.addPass(new OutputPass())
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
    const ratio = Math.min(window.devicePixelRatio, maxRatio)
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
