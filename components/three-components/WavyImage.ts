import {
  Object3D,
  Mesh,
  Vector2,
  PlaneGeometry,
  TextureLoader,
  ShaderMaterial,
  DoubleSide,
  MeshBasicMaterial,
} from 'three'

// NOTE: This class is in work in progress
export default class WavyImage extends Object3D {
  // This is the object that we want to sync the position of
  mesh: Mesh
  geometry: PlaneGeometry
  material: ShaderMaterial | MeshBasicMaterial

  element: HTMLImageElement
  sizes: Vector2
  offset: Vector2

  imageTexture: TextureLoader
  uniforms: any

  constructor(element: HTMLImageElement) {
    super()
    this.mesh = new Mesh()

    this.element = element
    this.sizes = new Vector2(0, 0)
    this.offset = new Vector2(0, 0)
    this.uniforms = {}
    this.createMesh()
  }

  getDimensions() {
    const { width, height, top, left } = this.element.getBoundingClientRect()
    this.sizes.set(width, height)
    this.offset.set(
      left - window.innerWidth / 2 + width / 2,
      -top + window.innerHeight / 2 - height / 2,
    )
  }

  createMesh() {
    this.getDimensions()
    this.geometry = new PlaneGeometry(1, 1, 30, 30)
    this.imageTexture = new TextureLoader().load(this.element.src)

    this.uniforms = {
      uTexture: { value: this.imageTexture },
      uOffset: { value: new Vector2(0, 0) },
      uAlpha: { value: 1 },
      uYPosition: { value: 0 },
      uMouse: { value: new Vector2(0, 0) },
    }

    this.material = new ShaderMaterial({
      vertexShader: `
      uniform sampler2D uTexture;
      uniform vec2 uOffset;
      uniform float uYPosition; // -1 to 1 from top to bottom
      varying vec2 vUv;

      #define M_PI 3.1415926535897932384626433832795

      vec3 deformationCurve(vec3 position, vec2 uv, vec2 offset) {
        // Squeeze the box top or bottom when offset.y is negative or positive
        position.x = position.x + (cos(uv.y * M_PI) * offset.x);
        position.y = position.y - offset.y * 0.3;
        position.z = position.z + (cos(uv.y * M_PI) * offset.y * 300.0) - (abs(offset.y) * 700.0);
        return position;
      }

      void main() {
        vUv = uv;
        vec3 newPosition = deformationCurve(position, uv, uOffset);
        gl_Position = projectionMatrix * modelViewMatrix * vec4( newPosition, 1.0 );
      }
      `,
      fragmentShader: `
      uniform sampler2D uTexture;
      uniform float uAlpha;
      uniform vec2 uOffset;
      uniform float uYPosition; // -1 to 1 from top to bottom
      varying vec2 vUv;

      vec3 rgbShift(sampler2D textureImage, vec2 uv, vec2 offset) {
        float r = texture2D(textureImage, uv + offset).r;
        vec2 gb = texture2D(textureImage, uv).gb;
        return vec3(r, gb);
      }

      void main() {
        // Moving the textrue in vertical direction based on the offset
        vec2 vUv = vUv + vec2(0.0, uYPosition * 0.25);
        // Scale the texture by 1.2 bigger and keep it in the center
        vUv = vUv * 0.9 + vec2(0.075, 0.075);

        //vec3 color = rgbShift(uTexture, vUv, uOffset);
        vec3 color = texture2D(uTexture, vUv).rgb;
        gl_FragColor = vec4(color, uAlpha);
      }
      `,
      uniforms: this.uniforms,
      transparent: true,
      side: DoubleSide,
    })

    this.mesh.geometry = this.geometry
    this.mesh.material = this.material
    this.mesh.scale.set(this.sizes.x, this.sizes.y, 1)
    this.add(this.mesh)
  }

  update(scrollYSpeed: number) {
    this.getDimensions()
    this.mesh.position.x = this.offset.x
    this.mesh.position.y = this.offset.y
    this.mesh.scale.set(this.sizes.x, this.sizes.y, 1)
    this.uniforms.uYPosition.value =
      ((this.offset.y - this.sizes.y / 2) /
        (window.innerHeight + this.sizes.y * 2)) *
      2
    this.uniforms.uOffset.value.set(this.offset.x * 0.0, -scrollYSpeed * 0.004)
    /* if (window.innerWidth < 460) {
      this.uniforms.uOffset.value.set(
        this.offset.x * 0.0,
        -scrollYSpeed * 0.0065,
      )
    } else if (window.innerWidth < 650) {
      this.uniforms.uOffset.value.set(
        this.offset.x * 0.0,
        -scrollYSpeed * 0.005,
      )
    } else if (window.innerWidth < 800) {
      this.uniforms.uOffset.value.set(
        this.offset.x * 0.0,
        -scrollYSpeed * 0.004,
      )
    } else {
      this.uniforms.uOffset.value.set(
        this.offset.x * 0.0,
        -scrollYSpeed * 0.003,
      )
    } */
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}
