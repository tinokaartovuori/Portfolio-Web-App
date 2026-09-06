import { motion } from '~/motion.config'

/**
 * The colour a light field's plate has before any light is drawn on it, as
 * CSS — so the page can paint the plate itself from the first frame and the
 * WebGL plate, arriving later in exactly this colour, replaces it unseen.
 *
 * The shader does `mix(uPage, uPlate, uPlateMix)` on three `Color`s, which
 * are linear, and encodes the result to sRGB on output. The same mix done in
 * sRGB lands a level off, so it is done here in linear light too.
 */
export type PlatePreset = keyof typeof motion.lightField.presets

const decode = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
const encode = (l: number) =>
  l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055

function channels(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map(
    (c) => c / 255,
  ) as [number, number, number]
}

/** `theme` 0 for light, 1 for dark. Returns `#rrggbb`. */
export function plateColor(preset: PlatePreset, theme: 0 | 1) {
  const { palette, lightField } = motion
  // The page colour is the text colour of the other theme (LightField.applyTheme)
  const page = channels(palette.base[theme === 0 ? 1 : 0])
  const plate = channels(palette.plate[theme])
  const mix = lightField.presets[preset].plate[theme]
  const hex = page
    .map((p, i) => {
      const l = (1 - mix) * decode(p) + mix * decode(plate[i]!)
      return Math.round(encode(l) * 255)
        .toString(16)
        .padStart(2, '0')
    })
    .join('')
  return `#${hex}`
}

/**
 * Inline style for the `.plate` element inside a light field's box: the same
 * inset and corner radius the shader draws, and the two theme colours as
 * custom properties the `.plate` rule in `index.css` picks between.
 */
export function plateStyle(preset: PlatePreset) {
  const { inset, cornerRadius } = motion.lightField.presets[preset]
  return {
    inset: `${inset}px`,
    borderRadius: `${cornerRadius}px`,
    '--plate-light': plateColor(preset, 0),
    '--plate-dark': plateColor(preset, 1),
  }
}
