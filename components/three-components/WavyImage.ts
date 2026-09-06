import {
  Color,
  DataTexture,
  Mesh,
  Vector2,
  PlaneGeometry,
  Texture,
  ShaderMaterial,
  DoubleSide,
} from 'three'
import { Spring } from '~/utils/spring'
import { ScrollFeel } from '~/utils/scrollFeel'
import { cursorUvIn } from '~/utils/cursorUv'
import { motion } from '~/motion.config'
import type { DomPinnedMesh } from './ElementManager'
import { HALATION_LAYER } from './HalationPass'
import type { FrameContext } from './FrameContext'
import { arrivalFor, advance, type Arrival } from './Arrival'
import {
  acquireTexture,
  releaseTexture,
  textureKeyFor,
  type TextureEntry,
} from './TextureCache'
import { viewport } from './Viewport'
import { grainShader, grainCell } from './grain'

const config = motion.image

type Variant = (typeof config.variants)[keyof typeof config.variants]

/** The rim's colour at each end of the theme: the text colour. */
const rimLight = new Color(motion.palette.base[0])
const rimDark = new Color(motion.palette.base[1])

/**
 * What the sampler reads until the photograph's own texture is attached: a
 * single transparent pixel. The mesh is invisible until then anyway; this
 * only keeps the uniform valid.
 */
const placeholder = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
placeholder.needsUpdate = true

/** The treatment named on the element, or none; an unknown name warns. */
function resolveVariant(name: string | undefined): Variant | null {
  if (!name) return null
  const variants: Record<string, Variant | undefined> = config.variants
  const variant = variants[name]
  if (!variant && import.meta.dev) {
    console.warn(
      `[WavyImage] unknown variant "${name}". Known variants: ${Object.keys(
        config.variants,
      ).join(', ')}.`,
    )
  }
  return variant ?? null
}

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
  /** Cover fit: the share of the texture the plane shows on each axis, and
   * where that window sits, so a box of any aspect crops the image the way
   * `object-fit: cover` would instead of stretching it. */
  uCover: { value: Vector2 }
  uCoverOffset: { value: Vector2 }
  uLensRadius: { value: number }
  uLensBulge: { value: number }
  uLensZoom: { value: number }
  uHoverAberration: { value: number }
  uTime: { value: number }
  /** Film grain: the share of grey mixed over the photograph (by theme),
   * its re-roll rate per second, and one cell's size in plane px. */
  uGrain: { value: number }
  uGrainRate: { value: number }
  /** One cell in device px, the box's position in the document in CSS px
   * and the pixel ratio: the grain is hashed from document positions, the
   * same cells the page grain has, so the two are one texture. */
  uGrainCell: { value: number }
  uGrainOrigin: { value: Vector2 }
  uGrainRatio: { value: number }
  /** The plane's size in px, for the grain's cells. */
  uSize: { value: Vector2 }
  /** The background treatment: greyscale share, transparency, edge dissolve. */
  uMono: { value: number }
  /** The hairline inside the edge: its colour (the text colour, by theme),
   * alpha and width in px. */
  uRim: { value: Color }
  uRimAlpha: { value: number }
  uRimWidth: { value: number }
  uFade: { value: number }
  uEdge: { value: number }
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
  uniform vec2 uCover;
  uniform vec2 uCoverOffset;
  uniform float uLensRadius;
  uniform float uLensZoom;
  uniform float uHoverAberration;
  uniform float uTime;
  uniform float uGrain;
  uniform float uGrainRate;
  uniform float uGrainCell;
  uniform vec2 uGrainOrigin;
  uniform float uGrainRatio;
  uniform vec2 uSize;
  uniform float uMono;
  uniform vec3 uRim;
  uniform float uRimAlpha;
  uniform float uRimWidth;
  uniform float uFade;
  uniform float uEdge;
  varying vec2 vUv;

  ${grainShader}

  void main() {
    vec2 uv = vUv;

    // The same lens as the vertex shader, magnifying the texture under the cursor
    vec2 d = (uv - uMouse) * vec2(uAspect, 1.0);
    float lens = exp(-dot(d, d) / (2.0 * uLensRadius * uLensRadius));
    uv = uMouse + (uv - uMouse) * (1.0 - uHover * uLensZoom * lens);

    // Overscan, centred, then slide the crop with the plane's viewport position
    uv = (uv - 0.5) * uZoom + 0.5;
    uv.y += uParallax;

    // Plane UV to texture UV: the window the plane shows of the image, so a
    // box of another aspect crops rather than stretches
    uv = uv * uCover + uCoverOffset;

    // Chromatic aberration: along the scroll axis with speed, radial under
    // the lens
    vec2 shift = vec2(0.0, uAberration) + (uv - uMouse) * lens * uHover * uHoverAberration;
    float r = texture2D(uTexture, uv + shift).r;
    float g = texture2D(uTexture, uv).g;
    float b = texture2D(uTexture, uv - shift).b;
    vec3 col = vec3(r, g, b);

    // The background treatment: greyscale, and dissolved from a rounded
    // shape (a superellipse inscribed in the plane, in its own UV) outward,
    // so the photograph sits into the page rather than on it
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(col, vec3(luma), uMono);
    float edge = 1.0;
    if (uEdge > 0.0) {
      vec2 q = abs(vUv - 0.5) * 2.0;
      float rim = pow(pow(q.x, 2.5) + pow(q.y, 2.5), 1.0 / 2.5);
      edge = 1.0 - smoothstep(1.0 - uEdge, 1.0, rim);
    }

    // The rim: a hairline just inside the edge, so the plane reads as a
    // thing with an edge. fwidth gives the size of a pixel in UV, so the
    // line is the same width on screen whatever the plane's size or tilt.
    vec2 px = fwidth(vUv);
    float toEdge = min(
      min(vUv.x, 1.0 - vUv.x) / px.x,
      min(vUv.y, 1.0 - vUv.y) / px.y
    );
    float rim = 1.0 - smoothstep(uRimWidth - 0.5, uRimWidth + 0.5, toEdge);
    col = mix(col, uRim, rim * uRimAlpha);

    // The film grain: the site's grain, hashed from where this point of the
    // plane is in the document (the box's position plus the plane's own
    // UV, so it rides with the photograph through its trail and tilt), the
    // same cells as the page grain around it, re-rolled at its own faster
    // rate; uGrain is the share of grey.
    if (uGrain > 0.0) {
      vec2 doc = (uGrainOrigin + vec2(vUv.x, 1.0 - vUv.y) * uSize) * uGrainRatio;
      float g = grainAt(doc, uGrainCell, floor(uTime * uGrainRate));
      col = grainOver(col, g, uGrain);
    }

    gl_FragColor = vec4(col, (1.0 - uFade) * edge);

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
 * The `<img>` it follows is a real, visible image: the photograph loads like
 * on any page, and the mesh takes over from it. The mesh draws nothing until
 * its texture — made from that very `<img>`, once decoded (TextureCache) — is
 * attached; then it is drawn, exactly on its box, *under* the img, and over
 * the next `motion.reveal.image` seconds the img fades out while the rim, the
 * trail, the lean and the float come in, gated by the same arrival clock. The
 * `<img>` being invisible from then on is what frees the mesh to deviate from
 * the box by a few tens of pixels. A `background` treatment has no DOM
 * version to hand over from, so its img stays hidden and the mesh fades in
 * from nothing.
 */
export default class WavyImage
  extends Mesh<PlaneGeometry, ShaderMaterial>
  implements DomPinnedMesh
{
  imageElement: HTMLImageElement
  dimensions = new Vector2()
  positionOffset = new Vector2()

  shaderUniforms: WavyImageUniforms

  /** The cached texture this mesh holds a reference to, once acquired. */
  private entry: TextureEntry | null = null
  /** Ready but not yet uploaded and attached: ImageManager takes one a frame. */
  pendingTexture: TextureEntry | null = null
  /** The arrival clock, on the element so a rebuild does not replay it. */
  private arrival: Arrival
  /** Whether the `<img>` is shown first and faded out over the mesh. */
  private domFirst: boolean
  private lastImgOpacity = Number.NaN
  private readonly onImgLoad = () => this.refreshTexture()

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
  /** The named treatment the element asked for, if any. */
  private variant: Variant | null
  /** How far the mesh hangs back from its box toward the viewport centre
   * this frame, px: the background variant's parallax. */
  private hangBack = 0
  /** width / height of the image file, 0 until it is known. */
  private imageAspect = 0
  /** Where the crop sits when the box and the image disagree on aspect, as
   * fractions: the element's CSS `object-position`, so a card can say
   * `object-right` and the mesh keeps that side. */
  private focus = new Vector2(0.5, 0.5)

  constructor(imageElement: HTMLImageElement) {
    super(new PlaneGeometry(1, 1, 32, 32), new ShaderMaterial())
    this.imageElement = imageElement
    this.variant = resolveVariant(imageElement.dataset.variant)
    this.domFirst = this.variant?.domFirst ?? true
    this.arrival = arrivalFor(imageElement)

    this.shaderUniforms = this.buildMaterial()
    // A photograph is a source of halation; the light fields are not, and
    // neither is a treatment that says so (the portrait behind the page)
    if (this.variant?.halation ?? 1) this.layers.enable(HALATION_LAYER)
    // Nothing to draw until the texture is attached
    this.visible = false
    this.resize()
    this.requestTexture()
  }

  /** Reads the `<img>` box: size, and its centre relative to the viewport centre. */
  measure() {
    const { width, height, top, left } =
      this.imageElement.getBoundingClientRect()
    this.dimensions.set(width, height)
    this.positionOffset.set(
      left - viewport.width / 2 + width / 2,
      -(top - viewport.top) + viewport.height / 2 - height / 2,
    )
    // The box in the document, for the grain (the band is in both terms)
    this.shaderUniforms?.uGrainOrigin.value.set(
      left,
      top - viewport.top + viewport.docTop,
    )
  }

  /**
   * Takes the texture for what the `<img>` currently shows, and watches for
   * the browser choosing another candidate (a resize across a `sizes` step).
   */
  private requestTexture() {
    this.entry = acquireTexture(this.imageElement, (entry) => {
      if (entry === this.entry) this.pendingTexture = entry
    })
    this.imageElement.addEventListener('load', this.onImgLoad)
  }

  private refreshTexture() {
    if (!this.entry || textureKeyFor(this.imageElement) === this.entry.key)
      return
    const previous = this.entry
    this.entry = acquireTexture(this.imageElement, (entry) => {
      if (entry === this.entry) this.pendingTexture = entry
    })
    releaseTexture(previous)
  }

  /** The texture is uploaded: sample it, crop it right, and draw. */
  attachTexture() {
    const entry = this.pendingTexture
    if (!entry) return
    this.pendingTexture = null
    this.shaderUniforms.uTexture.value = entry.texture
    if (entry.width && entry.height)
      this.imageAspect = entry.width / entry.height
    this.updateCover()
    this.visible = true
  }

  private buildMaterial() {
    // The `<img>` may already be decoded, in which case the crop is right
    // from the first frame rather than from the texture's own load
    const { naturalWidth, naturalHeight } = this.imageElement
    if (naturalWidth && naturalHeight)
      this.imageAspect = naturalWidth / naturalHeight

    const { hover, aberration } = config
    const shaderUniforms: WavyImageUniforms = {
      uTexture: { value: placeholder },
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
      uCover: { value: new Vector2(1, 1) },
      uCoverOffset: { value: new Vector2(0, 0) },
      uLensRadius: { value: hover.lensRadius },
      uLensBulge: { value: hover.lensBulge },
      uLensZoom: { value: hover.lensZoom },
      uHoverAberration: { value: aberration.hover },
      uTime: { value: 0 },
      uGrain: { value: 0 },
      uGrainRate: { value: motion.grain.rate },
      uGrainCell: { value: 1 },
      uGrainOrigin: { value: new Vector2() },
      uGrainRatio: { value: 1 },
      uSize: { value: new Vector2(1, 1) },
      uMono: { value: this.variant?.mono ?? 0 },
      uRim: { value: new Color(motion.palette.base[1]) },
      uRimAlpha: { value: 0 },
      uRimWidth: { value: config.rim.width },
      // A fading treatment starts fully transparent and comes up to its own
      // alpha as it arrives
      uFade: { value: this.domFirst ? 0 : 1 },
      uEdge: { value: this.variant?.edge ?? 0 },
    }

    // Opaque unless the treatment needs alpha: an opaque photograph occludes
    // the dust through the depth buffer, a faded one lets it show through.
    // The arrival needs no alpha of its own: an opaque mesh is drawn whole
    // under its img, and it is the img that fades.
    const translucent =
      (this.variant?.fade ?? 0) > 0 || (this.variant?.edge ?? 0) > 0
    const shaderMaterial = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: shaderUniforms,
      transparent: translucent,
      // A translucent one must not write depth either: its dissolved edges
      // are invisible but would still occlude whatever is drawn after them
      depthWrite: !translucent,
      side: DoubleSide,
    })

    // The placeholder handed to super() only existed to satisfy the base
    this.material.dispose()
    this.material = shaderMaterial

    return shaderUniforms
  }

  /**
   * Places the mesh on its box with every effect at rest. Used on creation and
   * on resize, where the previous frame's springs mean nothing any more.
   */
  resize() {
    this.measure()
    this.readFocus()
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
    // The visible viewport, not the canvas: the canvas is taller than the
    // window and sits where the scroll has it (viewport.top)
    const halfWidth = viewport.width / 2
    const halfHeight = window.innerHeight / 2
    const centreY = viewport.height / 2 - this.positionOffset.y + viewport.top
    this.shaderUniforms.uScreenCenter.value.set(
      this.positionOffset.x / halfWidth,
      (halfHeight - centreY) / halfHeight,
    )
    this.shaderUniforms.uScreenSize.value.set(
      this.dimensions.x / halfWidth,
      this.dimensions.y / halfHeight,
    )
    this.shaderUniforms.uAspect.value = this.dimensions.x / this.dimensions.y
    this.shaderUniforms.uSize.value.copy(this.dimensions)
    this.shaderUniforms.uGrainCell.value = grainCell(
      motion.grain.cell,
      viewport.ratio,
    )
    this.shaderUniforms.uGrainRatio.value = viewport.ratio
    this.updateCover()
  }

  /**
   * The element's CSS `object-position`, as fractions. Read on resize rather
   * than per frame: a computed style is not free, and a crop that moved
   * every frame would be a different feature.
   */
  private readFocus() {
    const [x = NaN, y = NaN] = getComputedStyle(this.imageElement)
      .objectPosition.split(' ')
      .map((part) => (part.endsWith('%') ? parseFloat(part) / 100 : NaN))
    this.focus.set(Number.isFinite(x) ? x : 0.5, Number.isFinite(y) ? y : 0.5)
  }

  /**
   * Cover fit: the window of the texture the plane shows. The axis on which
   * the image is larger than the box is cropped to the box's aspect, and the
   * crop sits where `object-position` says. Texture v runs bottom-up, so a
   * focus at the top (y = 0) is the window's top edge at v = 1.
   */
  private updateCover() {
    const { x: width, y: height } = this.dimensions
    const cover = this.shaderUniforms.uCover.value
    const offset = this.shaderUniforms.uCoverOffset.value
    if (!this.imageAspect || !width || !height) {
      cover.set(1, 1)
      offset.set(0, 0)
      return
    }
    const plane = width / height
    if (this.imageAspect > plane) {
      const share = plane / this.imageAspect
      cover.set(share, 1)
      offset.set(this.focus.x * (1 - share), 0)
    } else {
      const share = this.imageAspect / plane
      cover.set(1, share)
      offset.set(0, (1 - this.focus.y) * (1 - share))
    }
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
      viewport.width / 2 + this.positionOffset.x - width / 2 + this.drift.x
    const top =
      viewport.height / 2 -
      this.positionOffset.y -
      height / 2 -
      (this.lag.value + this.drift.y + this.hangBack) +
      viewport.top

    return cursorUvIn(ctx.pointer, left, top, width, height, cursorScratch)
  }

  /** The `<img>`'s opacity, written only when it changes. */
  private setImgOpacity(value: number) {
    const rounded = Math.round(value * 1000) / 1000
    if (rounded === this.lastImgOpacity) return
    this.lastImgOpacity = rounded
    this.imageElement.style.opacity = rounded >= 1 ? '' : String(rounded)
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
    const viewportY =
      (viewport.height / 2 -
        this.positionOffset.y +
        viewport.top -
        window.innerHeight / 2) /
      window.innerHeight
    const parallaxLimit = (1 - config.zoom) / 2
    uniforms.uParallax.value = Math.max(
      -parallaxLimit,
      Math.min(parallaxLimit, viewportY * config.parallax),
    )
    this.scale.set(width, height, 1)
    this.updateScreenUniforms()

    // The rim follows the text colour through a theme switch
    uniforms.uRim.value.copy(rimLight).lerp(rimDark, ctx.theme)
    const { alpha } = motion.grain
    uniforms.uGrain.value =
      (alpha[0] + (alpha[1] - alpha[0]) * ctx.theme) * config.grain.amount

    // Nothing else until the texture is attached and has been drawn once:
    // the mesh sits on its box (as it is drawn, whole, under the img on that
    // first frame) and the img is what the visitor sees
    if (!this.visible) return
    const arrived =
      this.arrival.t >= 1
        ? 1
        : ctx.rendered
          ? advance(
              this.arrival,
              dt,
              this.domFirst ? motion.reveal.image : motion.reveal.background,
              ctx.reduced,
            )
          : 0
    // The handover: the img fades out over the finished mesh (opaque, so the
    // two never show the page colour between them), the treatment fades in
    if (this.domFirst) this.setImgOpacity(1 - arrived)
    else uniforms.uFade.value = 1 - (1 - (this.variant?.fade ?? 0)) * arrived
    uniforms.uRimAlpha.value =
      config.rim.alpha * (this.variant?.rim ?? 1) * arrived

    if (ctx.reduced) {
      this.hangBack = 0
      this.position.set(this.positionOffset.x, this.positionOffset.y, 0)
      this.rotation.set(0, 0, 0)
      uniforms.uBend.value = 0
      uniforms.uEnergy.value = 0
      uniforms.uAberration.value = 0
      uniforms.uHover.value = 0
      // A still grain is texture; a moving one is motion
      uniforms.uTime.value = 0
      return
    }

    // Trail: the mesh lags the box in the direction the content is moving.
    // Scrolling down moves content up the screen; the image stays behind, lower.
    // A background image keeps only a share of the motion, and none of the
    // hover: it is scenery, and scenery that jumps is noise. Everything that
    // takes the mesh off its box is scaled by the arrival, so the img and the
    // mesh agree to the pixel while one fades into the other.
    const keep = (this.variant?.motion ?? 1) * arrived
    const energyKept = energy * keep
    this.lag.target = -config.lag.max * drive * keep
    this.lag.update(dt)

    // The bubble, on the mesh as a whole: tilt away from the viewport centre
    // and drift outward, both scaled by where the plane sits on screen
    const { bubble } = config
    const screen = uniforms.uScreenCenter.value
    const bubbleTiltX = -screen.y * bubble.tilt * energyKept
    const bubbleTiltY = screen.x * bubble.tilt * energyKept
    const spread = screen.x * bubble.spread * energyKept

    // The lean: on a wide viewport the image turns toward the viewport
    // centre (yaw about y: the inner edge recedes; roll about z: the top
    // leans in), by how far from the centre it sits
    const { lean } = config
    const wide = Math.min(
      1,
      Math.max(0, (viewport.width - lean.from) / (lean.to - lean.from)),
    )
    const leanScale = (this.variant?.lean ?? 1) * arrived
    const leanY = -screen.x * lean.yaw * wide * leanScale
    const leanZ = screen.x * lean.roll * wide * leanScale

    // A background image hangs back toward the viewport centre by a share
    // of its distance from it, so it moves slower than the page over it
    this.hangBack =
      -this.positionOffset.y * (this.variant?.parallax ?? 0) * arrived

    // Idle drift
    const { float } = config
    this.drift.set(
      Math.cos(time * float.speed * 0.8 + this.phase) *
        float.amplitude *
        keep *
        0.6 +
        spread,
      Math.sin(time * float.speed + this.phase) * float.amplitude * keep,
    )

    // Cursor
    const { hover } = config
    const cursor = (this.variant?.hover ?? 1) > 0 ? this.cursorUv(ctx) : null
    this.hover.target = cursor ? arrived : 0
    if (cursor) {
      this.cursorX.target = cursor.x
      this.cursorY.target = cursor.y
      // Tilt toward the cursor: the side under it comes toward the viewer
      this.tiltX.target = (cursor.y - 0.5) * 2 * hover.tilt * arrived
      this.tiltY.target = -(cursor.x - 0.5) * 2 * hover.tilt * arrived
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
    const depth =
      hoverAmount * hover.lift - config.recede * Math.abs(drive) * keep

    this.position.set(
      this.positionOffset.x + this.drift.x,
      this.positionOffset.y + this.lag.value + this.drift.y + this.hangBack,
      depth,
    )
    this.rotation.set(
      this.tiltX.value + bubbleTiltX,
      this.tiltY.value + bubbleTiltY + leanY,
      leanZ,
    )

    uniforms.uBend.value = (this.lag.value * config.bend) / height
    uniforms.uEnergy.value = energyKept
    uniforms.uAberration.value = config.aberration.scroll * drive * keep
    uniforms.uHover.value = hoverAmount
    uniforms.uMouse.value.set(this.cursorX.value, this.cursorY.value)

    uniforms.uTime.value = time
  }

  /** Shows the `<img>` again: the scene is going away. */
  restoreDom() {
    if (!this.domFirst) return
    this.lastImgOpacity = Number.NaN
    this.imageElement.style.opacity = ''
  }

  /**
   * Dispose the mesh geometry and material, and give the texture back to the
   * cache — never dispose it: the next build of this same image (a rebuild
   * happens on every registration burst) takes it again without an upload.
   */
  dispose() {
    this.imageElement.removeEventListener('load', this.onImgLoad)
    if (this.entry) releaseTexture(this.entry)
    this.entry = null
    this.pendingTexture = null
    this.geometry.dispose()
    this.material.dispose()
  }
}

// One scratch vector for cursor lookups, so the hover test allocates nothing
const cursorScratch = new Vector2()
