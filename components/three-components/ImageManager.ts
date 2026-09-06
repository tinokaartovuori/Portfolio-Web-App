import type { Scene, WebGLRenderer } from 'three'
import WavyImage from './WavyImage'
import type { FrameContext } from './FrameContext'

export default class ImageManager {
  scene: Scene
  renderer: WebGLRenderer
  images: WavyImage[]

  constructor(scene: Scene, renderer: WebGLRenderer) {
    this.images = []
    this.scene = scene
    this.renderer = renderer
  }

  loadImages(images: Record<string, HTMLImageElement>) {
    for (const imageElement of Object.values(images)) {
      // The constructor places it at rest; the frame loop takes over next tick
      const image = new WavyImage(imageElement)
      this.images.push(image)
      this.scene.add(image)
    }
  }

  removeImages() {
    this.images.forEach((image) => {
      this.scene.remove(image)
      image.dispose()
    })
    this.images = []
  }

  /**
   * Per-frame physics and placement. One image whose texture has become
   * ready is given it per frame — uploaded here, in the transform stage,
   * rather than in the middle of the draw — so a page of photographs
   * arriving together costs one upload a frame instead of a stall.
   */
  updateImages(ctx: FrameContext) {
    for (const image of this.images) {
      const entry = image.pendingTexture
      if (!entry) continue
      this.renderer.initTexture(entry.texture)
      image.attachTexture()
      break
    }
    this.images.forEach((image) => image.update(ctx))
  }

  /** Re-measures every image with its effects at rest, after a viewport change. */
  resizeImages() {
    this.images.forEach((image) => image.resize())
  }

  /** Shows every `<img>` again: the scene is going away (unmount, context lost). */
  restoreDom() {
    this.images.forEach((image) => image.restoreDom())
  }
}
