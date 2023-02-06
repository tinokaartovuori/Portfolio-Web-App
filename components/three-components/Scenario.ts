import { Scene, OrthographicCamera, WebGLRenderer, Clock, Color } from 'three'

export default class Scenario {
  scene: Scene
  camera: OrthographicCamera
  renderer: WebGLRenderer
  clock: Clock

  width: number
  height: number

  constructor(canvas: HTMLCanvasElement) {
    this.width = window.innerWidth
    this.height = window.innerHeight

    this.scene = new Scene()
    this.camera = new OrthographicCamera(
      -this.width / 2,
      this.width / 2,
      this.height / 2,
      -this.height / 2,
      1,
      1000,
    )
    this.camera.position.z = 500

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
    })
    this.renderer.setClearColor(new Color(0xffffff), 0)
    this.renderer.setSize(this.width, this.height)

    this.clock = new Clock()
  }

  updateCameraSize(width: number, height: number) {
    this.camera.left = -width / 2
    this.camera.right = width / 2
    this.camera.top = height / 2
    this.camera.bottom = -height / 2
    this.camera.updateProjectionMatrix()
  }

  updateRendererSize(width: number, height: number) {
    this.renderer.setSize(width, height)
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }
}
