import { Scene } from 'three'
import WavyImage from './WavyImage'
import type { FrameContext } from './FrameContext'

export default class ImageManager {
  scene: Scene
  images: WavyImage[]

  constructor(scene: Scene) {
    this.images = []
    this.scene = scene
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

  /** Per-frame physics and placement. */
  updateImages(ctx: FrameContext) {
    this.images.forEach((image) => image.update(ctx))
  }

  /** Re-measures every image with its effects at rest, after a viewport change. */
  resizeImages() {
    this.images.forEach((image) => image.resize())
  }
}
