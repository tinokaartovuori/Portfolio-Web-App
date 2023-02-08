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
      image.update(0)
    }
  }

  removeImages() {
    this.images.forEach((image) => this.scene.remove(image))
    this.images = []
  }

  updateImages(scrollYSpeed: number) {
    this.images.forEach((image) => image.update(scrollYSpeed))
  }
}
