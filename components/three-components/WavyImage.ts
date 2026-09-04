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
import { Spring } from '~/utils/spring'
import { ScrollFeel } from '~/utils/scrollFeel'
import { cursorUvIn } from '~/utils/cursorUv'
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
  /** 0 at rest, 1 on the hardest scroll: how much of the image tears. */
  uGlitch: { value: number }
  uTime: { value: number }
  uGlitchSlices: { value: number }
  uGlitchRate: { value: number }
  uGlitchShift: { value: number }
  uGlitchShare: { value: number }
  /** Film grain amplitude in colour units, and its re-roll rate per second. */
  uGrain: { value: number }
  uGrainRate: { value: number }
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
  uniform float uGlitch;
  uniform float uTime;
  uniform float uGlitchSlices;
  uniform float uGlitchRate;
  uniform float uGlitchShift;
  uniform float uGlitchShare;
  uniform float uGrain;
  uniform float uGrainRate;
  varying vec2 vUv;

  // Per-pixel hash without a sine, which shows its period on some GPUs
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec2 uv = vUv;

    // The same lens as the vertex shader, magnifying the texture under the cursor
    vec2 d = (uv - uMouse) * vec2(uAspect, 1.0);
    float lens = exp(-dot(d, d) / (2.0 * uLensRadius * uLensRadius));
    uv = uMouse + (uv - uMouse) * (1.0 - uHover * uLensZoom * lens);

    // Glitch: on a hard scroll some horizontal slices tear sideways. Which
    // ones and how far is re-rolled a few times a second, so it flickers
    // rather than slides.
    float tear = 0.0;
    if (uGlitch > 0.0) {
      float frame = floor(uTime * uGlitchRate);
      float band = floor(uv.y * uGlitchSlices);
      float on = step(1.0 - uGlitch * uGlitchShare, hash(vec2(band, frame)));
      tear = on * (hash(vec2(frame, band)) * 2.0 - 1.0) * uGlitchShift * uGlitch;
      uv.x += tear;
    }

    // Overscan, centred, then slide the crop with the plane's viewport position
    uv = (uv - 0.5) * uZoom + 0.5;
    uv.y += uParallax;

    // Chromatic aberration: along the scroll axis with speed, radial under
    // the lens, and sideways in a torn slice
    vec2 shift = vec2(tear * 0.4, uAberration) + (uv - uMouse) * lens * uHover * uHoverAberration;
    float r = texture2D(uTexture, uv + shift).r;
    float g = texture2D(uTexture, uv).g;
    float b = texture2D(uTexture, uv - shift).b;
    vec3 col = vec3(r, g, b);

    // Film grain, inside the photograph only, re-rolled a few times a second
    float grain = hash(gl_FragCoord.xy + floor(uTime * uGrainRate) * 17.0) - 0.5;
    col += grain * uGrain;

    gl_FragColor = vec4(col, 1.0);

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

  /** Smoothed scroll velocity, drive and energy. */
  private feel = new ScrollFeel(motion.scrollFeel)
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
      uGlitch: { value: 0 },
      uTime: { value: 0 },
      uGlitchSlices: { value: config.glitch.slices },
      uGlitchRate: { value: config.glitch.rate },
      uGlitchShift: { value: config.glitch.shift },
      uGlitchShare: { value: config.glitch.share },
      uGrain: { value: config.grain.amount },
      uGrainRate: { value: config.grain.rate },
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
    this.feel.reset()
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
    const { x: width, y: height } = this.dimensions

    // Screen-space top-left of the mesh: WebGL y is up, so the y offsets flip
    const left =
      window.innerWidth / 2 + this.positionOffset.x - width / 2 + this.drift.x
    const top =
      window.innerHeight / 2 -
      this.positionOffset.y -
      height / 2 -
      (this.lag.value + this.drift.y)

    return cursorUvIn(ctx.pointer, left, top, width, height, cursorScratch)
  }

  update(ctx: FrameContext) {
    this.measure()
    const { dt, time } = ctx
    const { x: width, y: height } = this.dimensions
    const uniforms = this.shaderUniforms

    // Smoothed per second rather than per frame, so the effect has the same
    // strength at 60, 120 and 144Hz; see ScrollFeel for the three stages
    this.feel.update(ctx.scroll.velocity, dt)
    const { drive, energy } = this.feel

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
      uniforms.uGlitch.value = 0
      // A still grain is texture; a moving one is motion
      uniforms.uTime.value = 0
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
    const bubbleTiltX = -screen.y * bubble.tilt * energy
    const bubbleTiltY = screen.x * bubble.tilt * energy
    const spread = screen.x * bubble.spread * energy

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
    uniforms.uEnergy.value = energy
    uniforms.uAberration.value = config.aberration.scroll * drive
    uniforms.uHover.value = hoverAmount
    uniforms.uMouse.value.set(this.cursorX.value, this.cursorY.value)

    // The glitch only exists past a hard scroll: nothing at a gentle glide,
    // ramping up between the two thresholds
    const { glitch } = config
    const speed = Math.abs(drive)
    const ramp = Math.min(
      1,
      Math.max(0, (speed - glitch.start) / (glitch.full - glitch.start)),
    )
    uniforms.uGlitch.value = ramp * ramp * (3 - 2 * ramp)
    uniforms.uTime.value = time
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
