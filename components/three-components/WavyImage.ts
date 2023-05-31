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

/**
 * Class representing a wavy image in 3D space using THREE.js library
 */
export default class WavyImage3D extends Object3D {
  // Object properties
  meshObject: Mesh
  planeGeometry: PlaneGeometry
  shaderMaterial: ShaderMaterial | MeshBasicMaterial

  imageElement: HTMLImageElement
  dimensions: Vector2
  positionOffset: Vector2

  scrollSpeedTarget: number
  scrollSpeedCurrent: number
  smoothingFactor: number

  imageTexture: TextureLoader
  shaderUniforms: any

  /**
   * Creates a WavyImage3D object
   * @param {HTMLImageElement} imageElement - The image to display as a 3D object
   */
  constructor(imageElement: HTMLImageElement) {
    super()

    this.meshObject = new Mesh()

    this.imageElement = imageElement
    this.dimensions = new Vector2(0, 0)
    this.positionOffset = new Vector2(0, 0)

    this.scrollSpeedTarget = 0
    this.scrollSpeedCurrent = 0
    this.smoothingFactor = 0.2

    this.shaderUniforms = {}
    this.createMeshObject()
  }

  /**
   * Calculates the dimensions and offsets of the image element
   */
  calculateDimensions() {
    const { width, height, top, left } =
      this.imageElement.getBoundingClientRect()
    this.dimensions.set(width, height)
    this.positionOffset.set(
      left - window.innerWidth / 2 + width / 2,
      -top + window.innerHeight / 2 - height / 2,
    )
  }

  /**
   * Creates the mesh object
   */
  createMeshObject() {
    this.calculateDimensions()
    this.planeGeometry = new PlaneGeometry(1, 1, 30, 30)
    this.imageTexture = new TextureLoader().load(this.imageElement.src)

    // Set shader uniforms
    this.shaderUniforms = {
      uTexture: { value: this.imageTexture },
      uScrollSpeed: { value: new Vector2(0, 0) },
      uAlpha: { value: 1 },
      uPlaneYPosition: { value: 0 },
      uMouse: { value: new Vector2(0, 0) },
      uPlaneRelativeYSize: { value: 0 },
    }

    // Create shader material
    this.shaderMaterial = new ShaderMaterial({
      vertexShader: `
      // Define uniforms
      uniform sampler2D uTexture;
      uniform vec2 uScrollSpeed;
      uniform float uPlaneYPosition; 
      uniform float uPlaneRelativeYSize; 
      varying vec2 vUv;

      #define M_PI 3.1415926535897932384626433832795

      // Function for mapping values from one range to another
      float map(float value, float start1, float stop1, float start2, float stop2) {
        return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
      }

      // Function for calculating the curve effect based on screen Y point and amount
      float curveEffect(float screenYPoint, float amount) {
        return sin(screenYPoint * M_PI) * amount;
      }

      // Function for calculating the curve effect matching
      float curveEffectMatching(float uvY, float direction) {
        float planeRelativeYSize = uPlaneRelativeYSize;
        float planeTop = uPlaneYPosition - planeRelativeYSize / 2.0;
        float planeBottom = uPlaneYPosition + planeRelativeYSize / 2.0;
        float uvYMatching = map(uvY, 0.0, 1.0, planeBottom, planeTop);
        return curveEffect(uvYMatching + (0.25 * direction), 20.0);
      }

      // Function for deformation curve
      vec3 deformationCurve(vec3 position, vec2 uv, vec2 offset) {
        float distFromCenter = abs(uPlaneYPosition);
        float effectFactor = distFromCenter * 10.0;

        position.x = position.x + (sin(uv.y * M_PI) * offset.x) * 0.2;
        position.y = position.y + (sin(uv.x * M_PI) * offset.y) * 0.2;

        float direction = offset.y > 0.0 ? 1.0 : -1.0;
        position.z = position.z + curveEffectMatching(uv.y, direction) * 60.0 * offset.y - abs(offset.y) * 500.0;

        return position;
      }

      void main() {
        vUv = uv;
        vec3 newPosition = deformationCurve(position, uv, uScrollSpeed);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
      `,
      fragmentShader: `
      // Define uniforms
      uniform sampler2D uTexture;
      uniform float uAlpha;
      uniform vec2 uScrollSpeed;
      uniform float uPlaneYPosition; 
      uniform float uRelativePlaneYSize;
      varying vec2 vUv;

      // Function for RGB shift
      vec3 rgbShift(sampler2D textureImage, vec2 uv, vec2 offset) {
        float r = texture2D(textureImage, uv + offset).r;
        vec2 gb = texture2D(textureImage, uv).gb;
        return vec3(r, gb);
      }

      void main() {
        vec2 newUV = vUv - vec2(0.0, (uPlaneYPosition / 2.0) * 0.30);

        // Scale the texture by 1.2 bigger and keep it in the center
        newUV = newUV * 0.9 + vec2(0.075, 0.075);

        vec3 color = texture2D(uTexture, newUV).rgb;
        gl_FragColor = vec4(color, uAlpha);
      }
      `,
      uniforms: this.shaderUniforms,
      transparent: true,
      side: DoubleSide,
    })

    this.meshObject.geometry = this.planeGeometry
    this.meshObject.material = this.shaderMaterial
    this.meshObject.scale.set(this.dimensions.x, this.dimensions.y, 1)
    this.add(this.meshObject)
  }

  /**
   * Updates the mesh object based on scroll speed
   * @param {number} scrollYSpeed - The vertical scroll speed
   */
  update(scrollYSpeed: number) {
    this.calculateDimensions()

    this.scrollSpeedTarget = scrollYSpeed

    // Update mesh position and scale
    this.meshObject.position.x = this.positionOffset.x
    this.meshObject.position.y = this.positionOffset.y

    this.meshObject.scale.set(this.dimensions.x, this.dimensions.y, 1)

    // Update shader uniforms
    this.shaderUniforms.uPlaneYPosition.value =
      -this.positionOffset.y / window.innerHeight
    this.shaderUniforms.uPlaneRelativeYSize.value =
      this.dimensions.y / window.innerHeight

    // Smooth scroll speed
    this.scrollSpeedCurrent +=
      (this.scrollSpeedTarget - this.scrollSpeedCurrent) * this.smoothingFactor

    this.shaderUniforms.uScrollSpeed.value.set(
      this.positionOffset.x * 0.0,
      -this.scrollSpeedCurrent * 0.004,
    )
  }

  /**
   * Dispose the mesh geometry and material
   */
  dispose() {
    this.meshObject.geometry.dispose()
    this.meshObject.material.dispose()
  }
}
