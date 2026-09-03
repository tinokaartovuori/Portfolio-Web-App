import { Scene, WebGLRenderer, Color, PerspectiveCamera } from 'three'

export default class Scenario {
  scene: Scene
  camera: PerspectiveCamera
  perspective: number
  fov: number
  aspectRatio: number
  renderer: WebGLRenderer

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
    this.renderer.setClearColor(new Color(0xffffff), 0)
    this.renderer.setSize(this.width, this.height)
    this.updatePixelRatio()
  }

  /**
   * Applies the device pixel ratio, capped to keep the fragment cost sane on
   * high density displays and lower still on touch devices
   */
  private updatePixelRatio() {
    const maxRatio = window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxRatio))
  }

  updateCameraSize(width: number, height: number) {
    this.aspectRatio = width / height
    this.fov = (180 * (2 * Math.atan(height / 2 / this.perspective))) / Math.PI
    this.camera.aspect = this.aspectRatio
    this.camera.fov = this.fov
    this.camera.updateProjectionMatrix()
  }

  updateRendererSize(width: number, height: number) {
    this.renderer.setSize(width, height)
    this.updatePixelRatio()
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }
}
