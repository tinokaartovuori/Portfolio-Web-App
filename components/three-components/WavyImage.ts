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
import { Spring } from '~/utils/spring'
import { motion } from '~/motion.config'
import type { DomPinnedMesh } from './ElementManager'
import type { FrameContext } from './FrameContext'

const config = motion.image

/**
 * The uniform set the shaders below declare. Spelling it out keeps the update
 * path type-checked instead of indexing into `{ [name: string]: IUniform }`,
 * where every `.value` is `any`.
 */
type WavyImageUniforms = {
  uTexture: { value: Texture }
  /** Extra trail inside the plane, as a share of the plane's height. */
  uBend: { value: number }
  /**
   * The plane's centre and size in viewport units, where the viewport spans
   * [-1, 1] on both axes with y up. This is what makes the deformation depend
   * on where the plane sits on screen.
   */
  uScreenCenter: { value: Vector2 }
  uScreenSize: { value: Vector2 }
  /** Smoothed scroll energy, 0..1: how hard the page is currently moving. */
  uEnergy: { value: number }
  uBubbleDepth: { value: number }
  /** Vertical chromatic aberration from scroll speed, in UV units. */
  uAberration: { value: number }
  /** Vertical texture offset from the plane's viewport position, in UV units. */
  uParallax: { value: number }
  uZoom: { value: number }
  /** Smoothed cursor position over the plane, in UV space. */
  uMouse: { value: Vector2 }
  /** 0 at rest, 1 fully hovered; springs through the values between. */
  uHover: { value: number }
  /** width / height, so the lens under the cursor is round on screen. */
  uAspect: { value: number }
  uLensRadius: { value: number }
  uLensBulge: { value: number }
  uLensZoom: { value: number }
  uHoverAberration: { value: number }
}

const vertexShader = /* glsl */ `
  uniform float uBend;
  uniform vec2 uScreenCenter;
  uniform vec2 uScreenSize;
  uniform float uEnergy;
  uniform float uBubbleDepth;
  uniform vec2 uMouse;
  uniform float uHover;
  uniform float uAspect;
  uniform float uLensRadius;
  uniform float uLensBulge;
  varying vec2 vUv;

  #define M_PI 3.1415926535897932384626433832795

  void main() {
    vUv = uv;
    vec3 p = position;

    // Where this vertex is on screen, viewport spanning [-1, 1] with y up
    vec2 screen = uScreenCenter + (uv - 0.5) * uScreenSize;
    // 1 at the viewport centre, 0.5 at the middle of an edge, 0 in the corners
    float bubble = 1.0 - clamp(dot(screen, screen) * 0.5, 0.0, 1.0);

    // Trail inside the plane: a curtain through the centre, plus a sag that
    // follows the bubble — the side of the plane nearer the viewport centre
    // trails further, so a left-hand and a right-hand image are mirror images.
    // Local y is a share of the plane's height, so uBend is in the same unit.
    p.y += uBend * (0.4 * sin(uv.x * M_PI) + 0.6 * bubble);

    // The bubble: the page bulges toward the camera at the viewport centre and
    // away in the corners while scrolling. z is not scaled with the plane, so
    // this is straight world units.
    p.z += uBubbleDepth * uEnergy * (bubble - 0.5) * 2.0;

    // Liquid lens: a gaussian bulge toward the camera under the cursor
    vec2 d = (uv - uMouse) * vec2(uAspect, 1.0);
    float lens = exp(-dot(d, d) / (2.0 * uLensRadius * uLensRadius));
    p.z += uHover * lens * uLensBulge;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform float uAberration;
  uniform float uParallax;
  uniform float uZoom;
  uniform vec2 uMouse;
  uniform float uHover;
  uniform float uAspect;
  uniform float uLensRadius;
  uniform float uLensZoom;
  uniform float uHoverAberration;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;

    // The same lens as the vertex shader, magnifying the texture under the cursor
    vec2 d = (uv - uMouse) * vec2(uAspect, 1.0);
    float lens = exp(-dot(d, d) / (2.0 * uLensRadius * uLensRadius));
    uv = uMouse + (uv - uMouse) * (1.0 - uHover * uLensZoom * lens);

    // Overscan, centred, then slide the crop with the plane's viewport position
    uv = (uv - 0.5) * uZoom + 0.5;
    uv.y += uParallax;

    // Chromatic aberration: along the scroll axis with speed, radial under the lens
    vec2 shift = vec2(0.0, uAberration) + (uv - uMouse) * lens * uHover * uHoverAberration;
    float r = texture2D(uTexture, uv + shift).r;
    float g = texture2D(uTexture, uv).g;
    float b = texture2D(uTexture, uv - shift).b;
    gl_FragColor = vec4(r, g, b, 1.0);

    // The texture is decoded to linear on sample (colorSpace = SRGBColorSpace),
    // so the result has to be encoded back to the output space here. This
    // include and that colorSpace assignment are a pair — one without the other
    // double-encodes or double-decodes the image. Under an EffectComposer the
    // output space is the linear render target and OutputPass encodes at the end,
    // which this include handles on its own.
    #include <colorspace_fragment>
  }
`

/**
 * An image pinned to its `<img>`, with mass: it trails the box through a
 * spring, bends with scroll speed, drifts a little at rest, and lifts, tilts
 * and ripples under the cursor.
 *
 * How it moves while scrolling depends on where it is on screen. The page is
 * treated as a bubble seen face-on: vertices near the viewport centre come
 * toward the camera and vertices near the edges go away, each image tilts
 * away from the centre and drifts outward, and the trail sags on the side
 * nearer the centre — so an image at the left edge, one at the right edge and
 * one in the middle each deform differently, and the deformation changes as
 * the image travels up the screen.
 *
 * The `<img>` it follows is invisible, so the mesh is free to deviate from the
 * box by a few tens of pixels; nothing on the page depends on the two agreeing
 * to the pixel.
 */
export default class WavyImage
  extends Mesh<PlaneGeometry, ShaderMaterial>
  implements DomPinnedMesh
{
  imageElement: HTMLImageElement
  dimensions = new Vector2()
  positionOffset = new Vector2()

  imageTexture: Texture
  shaderUniforms: WavyImageUniforms

  /** Smoothed scroll velocity, px/s. */
  private velocity = 0
  /** Smoothed scroll magnitude, 0..1. */
  private energy = 0
  /** Vertical trail behind the DOM box, px. */
  private lag = new Spring(config.lag)
  private hover = new Spring(config.hover.spring)
  private tiltX = new Spring(config.hover.tiltSpring)
  private tiltY = new Spring(config.hover.tiltSpring)
  private cursorX = new Spring(config.hover.cursorSpring, 0.5)
  private cursorY = new Spring(config.hover.cursorSpring, 0.5)
  /** Idle drift phase, so the images do not all bob in unison. */
  private phase = Math.random() * Math.PI * 2
  /** Everything added to the box position this frame besides the trail, so
   * hover testing can account for it. */
  private drift = new Vector2()

  constructor(imageElement: HTMLImageElement) {
    super(new PlaneGeometry(1, 1, 32, 32), new ShaderMaterial())
    this.imageElement = imageElement

    const { imageTexture, shaderUniforms } = this.buildMaterial()
    this.imageTexture = imageTexture
    this.shaderUniforms = shaderUniforms
    this.resize()
  }

  /** Reads the `<img>` box: size, and its centre relative to the viewport centre. */
  measure() {
    const { width, height, top, left } =
      this.imageElement.getBoundingClientRect()
    this.dimensions.set(width, height)
    this.positionOffset.set(
      left - window.innerWidth / 2 + width / 2,
      -top + window.innerHeight / 2 - height / 2,
    )
  }

  private buildMaterial() {
    const imageTexture = new TextureLoader().load(this.imageElement.src)
    imageTexture.colorSpace = SRGBColorSpace

    const { hover, aberration } = config
    const shaderUniforms: WavyImageUniforms = {
      uTexture: { value: imageTexture },
      uBend: { value: 0 },
      uScreenCenter: { value: new Vector2() },
      uScreenSize: { value: new Vector2() },
      uEnergy: { value: 0 },
      uBubbleDepth: { value: config.bubble.depth },
      uAberration: { value: 0 },
      uParallax: { value: 0 },
      uZoom: { value: config.zoom },
      uMouse: { value: new Vector2(0.5, 0.5) },
      uHover: { value: 0 },
      uAspect: { value: 1 },
      uLensRadius: { value: hover.lensRadius },
      uLensBulge: { value: hover.lensBulge },
      uLensZoom: { value: hover.lensZoom },
      uHoverAberration: { value: aberration.hover },
    }

    const shaderMaterial = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: shaderUniforms,
      transparent: false,
      side: DoubleSide,
    })

    // The placeholder handed to super() only existed to satisfy the base
    this.material.dispose()
    this.material = shaderMaterial

    return { imageTexture, shaderUniforms }
  }

  /**
   * Places the mesh on its box with every effect at rest. Used on creation and
   * on resize, where the previous frame's springs mean nothing any more.
   */
  resize() {
    this.measure()
    this.lag.set(0)
    this.energy = 0
    this.drift.set(0, 0)
    this.position.set(this.positionOffset.x, this.positionOffset.y, 0)
    this.rotation.set(0, 0, 0)
    this.scale.set(this.dimensions.x, this.dimensions.y, 1)
    this.updateScreenUniforms()
  }

  /** The plane's place on screen, in the [-1, 1] viewport space the shader uses. */
  private updateScreenUniforms() {
    const halfWidth = window.innerWidth / 2
    const halfHeight = window.innerHeight / 2
    this.shaderUniforms.uScreenCenter.value.set(
      this.positionOffset.x / halfWidth,
      this.positionOffset.y / halfHeight,
    )
    this.shaderUniforms.uScreenSize.value.set(
      this.dimensions.x / halfWidth,
      this.dimensions.y / halfHeight,
    )
    this.shaderUniforms.uAspect.value = this.dimensions.x / this.dimensions.y
  }

  /**
   * Where the cursor is over the plane, in UV space, or null when it is not.
   * Measured against the box as the mesh is currently drawing it, i.e. with the
   * trail and the drift added, so the lens sits under the cursor and not a few
   * pixels off during a scroll.
   */
  private cursorUv(ctx: FrameContext): Vector2 | null {
    const { pointer } = ctx
    if (!pointer.active) return null
    const { x: width, y: height } = this.dimensions
    if (width === 0 || height === 0) return null

    // Screen-space top-left of the mesh: WebGL y is up, so the y offsets flip
    const left =
      window.innerWidth / 2 + this.positionOffset.x - width / 2 + this.drift.x
    const top =
      window.innerHeight / 2 -
      this.positionOffset.y -
      height / 2 -
      (this.lag.value + this.drift.y)

    const u = (pointer.x - left) / width
    const v = 1 - (pointer.y - top) / height
    if (u < 0 || u > 1 || v < 0 || v > 1) return null
    return cursorScratch.set(u, v)
  }

  update(ctx: FrameContext) {
    this.measure()
    const { dt, time } = ctx
    const { x: width, y: height } = this.dimensions
    const uniforms = this.shaderUniforms

    // Smooth the velocity per second rather than per frame, so the effect has
    // the same strength at 60, 120 and 144Hz
    this.velocity = damp(
      this.velocity,
      ctx.scroll.velocity,
      config.velocitySmoothing,
      dt,
    )
    // Soft saturation: proportional at normal speeds, capped on a hard flick
    const drive = Math.tanh(this.velocity / config.velocityScale)
    // How hard the page is moving, blended more slowly still so the bubble
    // swells and relaxes as one motion instead of pulsing with every notch
    this.energy = damp(this.energy, Math.abs(drive), config.energySmoothing, dt)

    // The crop slides with the plane's place in the viewport, clamped to the
    // overscan so the texture edge never shows
    const viewportY = -this.positionOffset.y / window.innerHeight
    const parallaxLimit = (1 - config.zoom) / 2
    uniforms.uParallax.value = Math.max(
      -parallaxLimit,
      Math.min(parallaxLimit, viewportY * config.parallax),
    )
    this.scale.set(width, height, 1)
    this.updateScreenUniforms()

    if (ctx.reduced) {
      this.position.set(this.positionOffset.x, this.positionOffset.y, 0)
      this.rotation.set(0, 0, 0)
      uniforms.uBend.value = 0
      uniforms.uEnergy.value = 0
      uniforms.uAberration.value = 0
      uniforms.uHover.value = 0
      return
    }

    // Trail: the mesh lags the box in the direction the content is moving.
    // Scrolling down moves content up the screen; the image stays behind, lower.
    this.lag.target = -config.lag.max * drive
    this.lag.update(dt)

    // The bubble, on the mesh as a whole: tilt away from the viewport centre
    // and drift outward, both scaled by where the plane sits on screen
    const { bubble } = config
    const screen = uniforms.uScreenCenter.value
    const bubbleTiltX = -screen.y * bubble.tilt * this.energy
    const bubbleTiltY = screen.x * bubble.tilt * this.energy
    const spread = screen.x * bubble.spread * this.energy

    // Idle drift
    const { float } = config
    this.drift.set(
      Math.cos(time * float.speed * 0.8 + this.phase) * float.amplitude * 0.6 +
        spread,
      Math.sin(time * float.speed + this.phase) * float.amplitude,
    )

    // Cursor
    const { hover } = config
    const cursor = this.cursorUv(ctx)
    this.hover.target = cursor ? 1 : 0
    if (cursor) {
      this.cursorX.target = cursor.x
      this.cursorY.target = cursor.y
      // Tilt toward the cursor: the side under it comes toward the viewer
      this.tiltX.target = (cursor.y - 0.5) * 2 * hover.tilt
      this.tiltY.target = -(cursor.x - 0.5) * 2 * hover.tilt
    } else {
      // The lens fades out where it was rather than sliding back to the centre
      this.tiltX.target = 0
      this.tiltY.target = 0
    }
    this.hover.update(dt)
    this.cursorX.update(dt)
    this.cursorY.update(dt)
    this.tiltX.update(dt)
    this.tiltY.update(dt)

    const hoverAmount = Math.max(0, this.hover.value)

    // Depth: lift toward the camera under the cursor, recede while scrolling
    // fast (the bubble adds its own per-vertex depth in the shader)
    const depth = hoverAmount * hover.lift - config.recede * Math.abs(drive)

    this.position.set(
      this.positionOffset.x + this.drift.x,
      this.positionOffset.y + this.lag.value + this.drift.y,
      depth,
    )
    this.rotation.set(
      this.tiltX.value + bubbleTiltX,
      this.tiltY.value + bubbleTiltY,
      0,
    )

    uniforms.uBend.value = (this.lag.value * config.bend) / height
    uniforms.uEnergy.value = this.energy
    uniforms.uAberration.value = config.aberration.scroll * drive
    uniforms.uHover.value = hoverAmount
    uniforms.uMouse.value.set(this.cursorX.value, this.cursorY.value)
  }

  /** Dispose the mesh geometry, material and texture. */
  dispose() {
    this.geometry.dispose()
    this.material.dispose()
    this.imageTexture.dispose()
  }
}

// One scratch vector for cursor lookups, so the hover test allocates nothing
const cursorScratch = new Vector2()
