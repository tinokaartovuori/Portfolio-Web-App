/**
 * Build-time image derivatives.
 *
 * The originals stay where the content points at them, `public/images/*.jpg`;
 * this writes, next to them:
 *
 *   public/images/gen/<name>-<width>.{avif,webp,jpg}   responsive candidates
 *   public/images/og/<name>.jpg                        1200×630 for og:image
 *   public/favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png
 *   assets/images.gen.json                             the manifest the app reads
 *
 * Everything generated is ignored by git and rebuilt by `modules/images.ts` on
 * every dev start and build (and by `npm run images`); a derivative newer than
 * its source is left alone, so a run with nothing to do takes a moment.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

/** Candidate widths, capped to the source; the source width is always one. */
const WIDTHS = [480, 768, 1080, 1440, 2000]
const QUALITY = { avif: 55, webp: 78, jpg: 80 }
const OG = { width: 1200, height: 630 }
const ICONS = [
  { file: 'apple-touch-icon.png', size: 180, flatten: true },
  { file: 'icon-192.png', size: 192, flatten: false },
  { file: 'icon-512.png', size: 512, flatten: false },
]
/** The page colour under a flattened icon: onyx. */
const ICON_BACKGROUND = '#0c0d12'

const SOURCE_EXT = /\.(jpe?g|png)$/i

export async function generateImages(root, { log = console.log } = {}) {
  const publicDir = path.join(root, 'public')
  const imagesDir = path.join(publicDir, 'images')
  const genDir = path.join(imagesDir, 'gen')
  const ogDir = path.join(imagesDir, 'og')
  await fs.mkdir(genDir, { recursive: true })
  await fs.mkdir(ogDir, { recursive: true })

  const entries = (await fs.readdir(imagesDir, { withFileTypes: true }))
    .filter((e) => e.isFile() && SOURCE_EXT.test(e.name))
    .map((e) => e.name)
    .sort()

  const manifest = {}
  let made = 0
  const started = Date.now()

  for (const file of entries) {
    const source = path.join(imagesDir, file)
    const name = file.replace(SOURCE_EXT, '')
    const stat = await fs.stat(source)
    const meta = await sharp(source).metadata()
    const width = meta.width ?? 0
    const height = meta.height ?? 0
    if (!width || !height) continue

    const widths = WIDTHS.filter((w) => w < width)
    widths.push(width)

    const jobs = []
    for (const w of widths) {
      for (const format of Object.keys(QUALITY)) {
        const out = path.join(genDir, `${name}-${w}.${format}`)
        if (await fresh(out, stat.mtimeMs)) continue
        jobs.push(async () => {
          const pipeline = sharp(source).resize({
            width: w,
            withoutEnlargement: true,
          })
          if (format === 'avif')
            pipeline.avif({ quality: QUALITY.avif, effort: 3 })
          else if (format === 'webp') pipeline.webp({ quality: QUALITY.webp })
          else
            pipeline.jpeg({
              quality: QUALITY.jpg,
              mozjpeg: true,
              progressive: true,
            })
          await pipeline.toFile(out)
          made++
        })
      }
    }

    const og = path.join(ogDir, `${name}.jpg`)
    if (!(await fresh(og, stat.mtimeMs))) {
      jobs.push(async () => {
        await sharp(source)
          .resize({
            width: OG.width,
            height: OG.height,
            fit: 'cover',
            position: 'attention',
          })
          .jpeg({ quality: 82, mozjpeg: true, progressive: true })
          .toFile(og)
        made++
      })
    }

    await runAll(jobs, 4)

    // The candidates' URLs follow from the name and the widths
    // (`/images/gen/<name>-<w>.<avif|webp|jpg>`, see utils/images.ts), so
    // the manifest carries only the widths and stays small in the bundle
    manifest[`/images/${file}`] = {
      width,
      height,
      og: `/images/og/${name}.jpg`,
      widths,
    }
  }

  made += await generateIcons(publicDir)

  const manifestPath = path.join(root, 'assets', 'images.gen.json')
  await fs.mkdir(path.dirname(manifestPath), { recursive: true })
  const json = JSON.stringify(manifest, null, 2) + '\n'
  const previous = await fs.readFile(manifestPath, 'utf8').catch(() => '')
  if (previous !== json) await fs.writeFile(manifestPath, json)

  log(
    `[images] ${entries.length} sources, ${made} files written in ${(
      (Date.now() - started) /
      1000
    ).toFixed(1)}s`,
  )
  return manifest
}

/** True when `out` exists and is newer than the source's mtime. */
async function fresh(out, sourceMtime) {
  const stat = await fs.stat(out).catch(() => null)
  return !!stat && stat.mtimeMs >= sourceMtime
}

async function runAll(jobs, limit) {
  const queue = [...jobs]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, () =>
    (async () => {
      while (queue.length) await queue.shift()()
    })(),
  )
  await Promise.all(workers)
}

/**
 * The favicon set from `public/favicon.svg`: the PNG sizes, and a `.ico`
 * holding one 32 px PNG (every current browser reads PNG-in-ICO; the file
 * exists for the clients that ask for `/favicon.ico` regardless of the
 * `<link>`s).
 */
async function generateIcons(publicDir) {
  const svg = path.join(publicDir, 'favicon.svg')
  const stat = await fs.stat(svg).catch(() => null)
  if (!stat) return 0
  let made = 0

  for (const { file, size, flatten } of ICONS) {
    const out = path.join(publicDir, file)
    if (await fresh(out, stat.mtimeMs)) continue
    let pipeline = sharp(svg, { density: 384 }).resize(size, size)
    if (flatten) pipeline = pipeline.flatten({ background: ICON_BACKGROUND })
    await pipeline.png().toFile(out)
    made++
  }

  const ico = path.join(publicDir, 'favicon.ico')
  if (!(await fresh(ico, stat.mtimeMs))) {
    const png = await sharp(svg, { density: 384 })
      .resize(32, 32)
      .png()
      .toBuffer()
    await fs.writeFile(ico, pngToIco(png, 32))
    made++
  }
  return made
}

/** Wraps one PNG in an ICO container. */
function pngToIco(png, size) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // one image
  const entry = Buffer.alloc(16)
  entry.writeUInt8(size, 0)
  entry.writeUInt8(size, 1)
  entry.writeUInt8(0, 2) // palette
  entry.writeUInt8(0, 3) // reserved
  entry.writeUInt16LE(1, 4) // planes
  entry.writeUInt16LE(32, 6) // bits per pixel
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(header.length + entry.length, 12)
  return Buffer.concat([header, entry, png])
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
  generateImages(root).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
