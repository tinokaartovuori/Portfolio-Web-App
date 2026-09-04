import {
  Mesh,
  Vector2,
  PlaneGeometry,
  TextureLoader,
  SRGBColorSpace,
  Texture,
  ShaderMaterial,
  DoubleSide,
} from 'three'
import { damp } from '~/composables/useFrameLoop'
import type { DomPinnedMesh } from './ElementManager'

/**
 * Decay rate of the scroll-speed smoothing, per second.
 * Ported from the previous per-frame factor of 0.2 tuned at 60fps:
 * lambda = -60 * ln(1 - 0.2).
 */
const SPEED_SMOOTHING = 13.386

/**
 * Peak deformation offset. The vertex shader multiplies this by ~1200 to get a
 * z displacement, and the camera sits at z=1000 — so 0.1 is about a 12% depth
 * swing across the plane, which reads as a bend. The original linear mapping
 * could reach 0.27 on a fast flick, skewing the plane into a trapezoid that
 * visibly tore away from the DOM box it is pinned to.
 */
const MAX_DEFORMATION = 0.1

/**
 * Velocity (px/s) at which the deformation reaches ~76% of its peak. Below
 * this the response is near-linear; above it, it saturates smoothly instead of
 * growing without bound.
 */
const DEFORMATION_VELOCITY_SCALE = 2000

/**
 * The uniform set the shaders below declare. Spelling it out keeps the update
 * path type-checked instead of indexing into `{ [name: string]: IUniform }`,
 * where every `.value` is `any`.
 */
type WavyImageUniforms = {
  uTexture: { value: Texture }
  uScrollSpeed: { value: Vector2 }
  uAlpha: { value: number }
  uPlaneYPosition: { value: number }
  uMouse: { value: Vector2 }
  uPlaneRelativeYSize: { value: number }
}

/**
 * Class representing a wavy image in 3D space using THREE.js library
 */
export default class WavyImage3D
  extends Mesh<PlaneGeometry, ShaderMaterial>
  implements DomPinnedMesh
{
  // Object properties
  imageElement: HTMLImageElement
  dimensions: Vector2
  positionOffset: Vector2

  scrollSpeedTarget: number
  scrollSpeedCurrent: number

  imageTexture: Texture
  shaderUniforms: WavyImageUniforms

  /**
   * Creates a WavyImage3D object
   * @param {HTMLImageElement} imageElement - The image to display as a 3D object
   */
  constructor(imageElement: HTMLImageElement) {
    super(new PlaneGeometry(1, 1, 30, 30), new ShaderMaterial())

    this.imageElement = imageElement
    this.dimensions = new Vector2(0, 0)
    this.positionOffset = new Vector2(0, 0)

    this.scrollSpeedTarget = 0
    this.scrollSpeedCurrent = 0

    const { imageTexture, shaderUniforms } = this.buildMaterial()
    this.imageTexture = imageTexture
    this.shaderUniforms = shaderUniforms
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
   * Loads the texture and builds the shader material this mesh renders with
   * @returns The texture and uniforms it was built from
   */
  buildMaterial() {
    this.calculateDimensions()
    const imageTexture = new TextureLoader().load(this.imageElement.src)
    imageTexture.colorSpace = SRGBColorSpace

    // Set shader uniforms
    const shaderUniforms: WavyImageUniforms = {
      uTexture: { value: imageTexture },
      uScrollSpeed: { value: new Vector2(0, 0) },
      uAlpha: { value: 1 },
      uPlaneYPosition: { value: 0 },
      uMouse: { value: new Vector2(0, 0) },
      uPlaneRelativeYSize: { value: 0 },
    }

    // Create shader material
    const shaderMaterial = new ShaderMaterial({
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
        // The pull-back is clamped: unclamped, a fast scroll pushed the plane
        // 200 units away from a camera at z=1000, shrinking it ~17% and visibly
        // detaching it from the DOM box it is supposed to be pinned to.
        float pullBack = min(abs(offset.y) * 500.0, 120.0);
        position.z = position.z + curveEffectMatching(uv.y, direction) * 60.0 * offset.y - pullBack;

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
      varying vec2 vUv;

      // Function for RGB shift
      vec3 rgbShift(sampler2D textureImage, vec2 uv, vec2 offset) {
        float r = texture2D(textureImage, uv + offset).r;
        vec2 gb = texture2D(textureImage, uv).gb;
        return vec3(r, gb);
      }

      void main() {
        vec2 newUV = vUv - vec2(0.0, (uPlaneYPosition / 2.0) * 0.30);

        // Zoom ~1.11x, centred. The old offset of 0.075 mapped [0,1] to
        // [0.075, 0.975], i.e. centred on 0.525 — every image sat 2.5% high.
        newUV = newUV * 0.9 + vec2(0.05, 0.05);

        // Chromatic aberration proportional to scroll speed. rgbShift was
        // defined here from the start but never called.
        vec3 color = rgbShift(uTexture, newUV, vec2(0.0, uScrollSpeed.y * 0.06));
        gl_FragColor = vec4(color, uAlpha);

        // The texture is decoded to linear on sample (colorSpace = SRGBColorSpace),
        // so the result has to be encoded back to the renderer's output space here.
        // This include and that colorSpace assignment are a pair — one without the
        // other double-encodes or double-decodes the image.
        #include <colorspace_fragment>
      }
      `,
      uniforms: shaderUniforms,
      transparent: false,
      side: DoubleSide,
    })

    // The placeholder handed to super() only existed to satisfy the base
    this.material.dispose()
    this.material = shaderMaterial
    this.scale.set(this.dimensions.x, this.dimensions.y, 1)

    return { imageTexture, shaderUniforms }
  }

  /**
   * Updates the mesh object based on scroll velocity
   * @param {number} scrollYVelocity - Vertical scroll velocity in pixels per second
   * @param {number} dt - Seconds since the previous frame
   */
  update(scrollYVelocity: number, dt: number) {
    this.calculateDimensions()

    this.scrollSpeedTarget = scrollYVelocity

    // Update mesh position and scale
    this.position.x = this.positionOffset.x
    this.position.y = this.positionOffset.y

    this.scale.set(this.dimensions.x, this.dimensions.y, 1)

    // Update shader uniforms
    this.shaderUniforms.uPlaneYPosition.value =
      -this.positionOffset.y / window.innerHeight
    this.shaderUniforms.uPlaneRelativeYSize.value =
      this.dimensions.y / window.innerHeight

    // Smooth the velocity per second rather than per frame, so the effect has
    // the same strength at 60, 120 and 144Hz
    this.scrollSpeedCurrent = damp(
      this.scrollSpeedCurrent,
      this.scrollSpeedTarget,
      SPEED_SMOOTHING,
      dt,
    )

    /*
     * Soft saturation rather than a linear scale: normal scrolling gets a
     * proportional response, and a hard flick tops out at MAX_DEFORMATION
     * instead of turning the plane inside out.
     */
    const deformation =
      MAX_DEFORMATION *
      Math.tanh(this.scrollSpeedCurrent / DEFORMATION_VELOCITY_SCALE)

    this.shaderUniforms.uScrollSpeed.value.set(
      // No horizontal scrolling exists, so the x deformation stays disabled
      0,
      -deformation,
    )
  }

  /**
   * Dispose the mesh geometry, material and texture
   */
  dispose() {
    this.geometry.dispose()
    this.material.dispose()
    this.imageTexture.dispose()
  }
}
