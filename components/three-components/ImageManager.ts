import { Scene } from 'three'
import WavyImage from './WavyImage'

export default class ImageManager {
  scene: Scene
  images: WavyImage[]

  constructor(scene: Scene) {
    this.images = []
    this.scene = scene
  }

  loadImages(images: Record<string, HTMLImageElement>) {
    for (const [key, imageElement] of Object.entries(images)) {
      const image = new WavyImage(imageElement as HTMLImageElement)
      this.images.push(image)
      this.scene.add(image)
      // Place it once at rest; the frame loop takes over from the next tick
      image.update(0, 0)
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
   * @param scrollYVelocity Vertical scroll velocity in pixels per second
   * @param dt Seconds since the previous frame
   */
  updateImages(scrollYVelocity: number, dt: number) {
    this.images.forEach((image) => image.update(scrollYVelocity, dt))
  }
}
