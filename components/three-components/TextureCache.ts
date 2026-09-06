import { SRGBColorSpace, Texture } from 'three'

/**
 * Textures made from the page's own `<img>` elements, shared across scene
 * rebuilds.
 *
 * A `WavyImage` used to fetch and decode its file a second time through
 * `TextureLoader`, and to throw the texture away on every rebuild (every
 * registration burst, every navigation), so each of those re-decoded and
 * re-uploaded every photograph on the page. Here the texture is made from
 * the decoded `<img>` itself — one fetch, one decode, and `currentSrc` is the
 * responsive candidate the browser chose — and lives on by key, refcounted,
 * until a sweep finds it unused and over budget.
 *
 * The pixels go through an `ImageBitmap` rather than the element: three sizes
 * a texture's storage from `image.width`, which on a laid-out `<img>` is its
 * CSS width, not the bitmap's, and the upload then overflows it. A bitmap
 * has the bitmap's size, and is its own copy, so the browser swapping the
 * element's candidate later cannot change what a texture already holds.
 */
export interface TextureEntry {
  key: string
  texture: Texture
  refs: number
  /** The image has decoded and the texture can be uploaded. */
  ready: boolean
  width: number
  height: number
  /** Rough GPU footprint, for the sweep. */
  bytes: number
  lastUsed: number
  waiters: Array<(entry: TextureEntry) => void>
}

const entries = new Map<string, TextureEntry>()

/** GPU budget for textures nobody is using at the moment. */
const IDLE_BUDGET = 96 * 1024 * 1024

let maxAnisotropy = 1

/** Told once by the canvas; every texture made after this uses it. */
export function setTextureAnisotropy(max: number) {
  maxAnisotropy = max
}

/** The key a given `<img>` resolves to right now. */
export function textureKeyFor(img: HTMLImageElement) {
  return img.currentSrc || img.src
}

/**
 * Takes a reference to the texture for the image the `<img>` currently
 * shows. `onReady` fires (possibly synchronously) once the image has decoded
 * and the texture can be uploaded; it does not fire for an image that fails.
 */
export function acquireTexture(
  img: HTMLImageElement,
  onReady: (entry: TextureEntry) => void,
): TextureEntry {
  const key = textureKeyFor(img)
  let entry = entries.get(key)
  if (!entry) {
    const texture = new Texture()
    texture.colorSpace = SRGBColorSpace
    // The planes are yawed and tilted, so a sampled photograph needs more
    // than the default single tap along the receding axis
    texture.anisotropy = Math.min(4, maxAnisotropy)
    entry = {
      key,
      texture,
      refs: 0,
      ready: false,
      width: 0,
      height: 0,
      bytes: 0,
      lastUsed: performance.now(),
      waiters: [],
    }
    entries.set(key, entry)
    void decodeInto(entry, img)
  }
  entry.refs++
  entry.lastUsed = performance.now()
  if (entry.ready) onReady(entry)
  else entry.waiters.push(onReady)
  return entry
}

/** Gives a reference back; nothing is freed until a sweep says so. */
export function releaseTexture(entry: TextureEntry) {
  entry.refs = Math.max(0, entry.refs - 1)
  entry.lastUsed = performance.now()
}

/**
 * Frees unused textures, least recently used first, while the unused set is
 * over budget. Called the frame after a rebuild, so a rebuild that takes a
 * reference back the same tick (remove → load) never loses its texture.
 */
export function sweepTextures(budget = IDLE_BUDGET) {
  const idle = [...entries.values()]
    .filter((entry) => entry.refs === 0)
    .sort((a, b) => a.lastUsed - b.lastUsed)
  let total = idle.reduce((sum, entry) => sum + entry.bytes, 0)
  for (const entry of idle) {
    if (total <= budget) break
    total -= entry.bytes
    free(entry)
    entries.delete(entry.key)
  }
}

/** Everything, on the canvas' unmount. */
export function disposeAllTextures() {
  for (const entry of entries.values()) free(entry)
  entries.clear()
}

function free(entry: TextureEntry) {
  entry.texture.dispose()
  const image = entry.texture.image as unknown
  if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap)
    image.close()
}

async function decodeInto(entry: TextureEntry, img: HTMLImageElement) {
  // Wait for the fetch if it has not finished; `decode()` then resolves once
  // the bitmap is ready, or rejects for a broken file, which leaves the entry
  // never ready and the mesh invisible — the `<img>` shows its alt as usual.
  // A decode that fails after a srcset swap (EncodingError, the old bitmap
  // was thrown away) is treated as ready: the copy below decodes on its own.
  try {
    if (!(img.complete && img.naturalWidth > 0)) await loaded(img)
    try {
      await img.decode()
    } catch {
      if (!img.naturalWidth) return
    }
  } catch {
    return
  }
  if (!entries.has(entry.key)) return

  const source = await copyPixels(img)
  if (!source || !entries.has(entry.key)) return
  entry.width = source.width
  entry.height = source.height
  // RGBA plus a third for the mip chain
  entry.bytes = Math.round(entry.width * entry.height * 4 * 1.34)
  entry.texture.image = source
  // A bitmap is flipped on creation (UNPACK_FLIP_Y does not apply to it); a
  // canvas fallback is flipped on upload like any element
  entry.texture.flipY = !(
    typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap
  )
  entry.texture.needsUpdate = true
  entry.ready = true
  const waiters = entry.waiters
  entry.waiters = []
  for (const waiter of waiters) waiter(entry)
}

/**
 * The decoded pixels at the bitmap's own size, as an ImageBitmap where the
 * browser has it (off the main thread), else drawn onto a canvas.
 */
async function copyPixels(
  img: HTMLImageElement,
): Promise<ImageBitmap | HTMLCanvasElement | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(img, {
        imageOrientation: 'flipY',
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'none',
      })
    } catch {
      // Fall through to the canvas
    }
  }
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) return null
  context.drawImage(img, 0, 0)
  return canvas
}

function loaded(img: HTMLImageElement) {
  return new Promise<void>((resolve, reject) => {
    const done = () => {
      img.removeEventListener('load', done)
      img.removeEventListener('error', fail)
      resolve()
    }
    const fail = () => {
      img.removeEventListener('load', done)
      img.removeEventListener('error', fail)
      reject(new Error('image failed'))
    }
    img.addEventListener('load', done)
    img.addEventListener('error', fail)
  })
}
