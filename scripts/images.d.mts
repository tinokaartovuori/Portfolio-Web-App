export interface GeneratedImage {
  /** The original's pixel size. */
  width: number
  height: number
  /** The 1200×630 crop for `og:image`. */
  og: string
  /** Widths generated, ascending, the original's own width last. Each is at
   * `/images/gen/<name>-<width>.{avif,webp,jpg}`. */
  widths: number[]
}

export type ImageManifest = Record<string, GeneratedImage>

export function generateImages(
  root: string,
  options?: { log?: (message: string) => void },
): Promise<ImageManifest>
