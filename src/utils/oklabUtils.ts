/**
 * Full credit to the original author of this code:
 * https://github.com/beenotung/oklab.ts/blob/main/src/oklab.ts
 */

import type { RGB } from './colorUtils'

// See https://bottosson.github.io/posts/oklab/
// and https://observablehq.com/@fil/oklab-color-space
// and https://github.com/Butterwell/oklab

export type Oklab = {
  L: number
  a: number
  b: number
}

export function newRgb(): RGB {
  return [0, 0, 0]
}

export function newOklab(): Oklab {
  return { L: 0, a: 0, b: 0 }
}

export function rgbToOklab(c: RGB): Oklab
export function rgbToOklab(c: RGB, o: Oklab): void
export function rgbToOklab(c: RGB, o?: Oklab): void | Oklab {
  if (!o) {
    o = newOklab()
    rgbToOklab(c, o)
    return o
  }

  const r = gamma_inv(c[0] / 255)
  const g = gamma_inv(c[1] / 255)
  const b = gamma_inv(c[2] / 255)

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  o.L = l * +0.2104542553 + m * +0.793617785 + s * -0.0040720468
  o.a = l * +1.9779984951 + m * -2.428592205 + s * +0.4505937099
  o.b = l * +0.0259040371 + m * +0.7827717662 + s * -0.808675766
}

function toFractionalRgb(ok: Oklab, c: RGB): void {
  const L = ok.L
  const a = ok.a
  const b = ok.b

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3

  c[0] = 255 * gamma(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)
  c[1] = 255 * gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)
  c[2] = 255 * gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
}

export function oklabToRgb(ok: Oklab): RGB
export function oklabToRgb(ok: Oklab, c: RGB): void
export function oklabToRgb(ok: Oklab, c?: RGB): void | RGB {
  if (!c) {
    c = newRgb()
    oklabToRgb(ok, c)
    return c
  }

  toFractionalRgb(ok, c)
  normalizeRgb(c)
}

function clamp(c: number): number {
  const cc = Math.round(c)
  return cc < 0 ? 0 : cc > 255 ? 255 : cc
}

function normalizeRgb(c: RGB): void {
  c[0] = clamp(c[0])
  c[1] = clamp(c[1])
  c[2] = clamp(c[2])
}

/**
 * @example "oklab(0.5 0.2 0.1)"
 * @example "oklab(0.5 0.2 0.1 / 50%)"
 * @example "oklab(0.5 0.2 0.1 / 0.5)"
 */
export function oklabToCssString(ok: Oklab, alpha?: number): string {
  if (typeof alpha != 'number') return `oklab(${ok.L} ${ok.a} ${ok.b})`
  if (alpha > 1) return `oklab(${ok.L} ${ok.a} ${ok.b} / ${alpha}%)`
  return `oklab(${ok.L} ${ok.a} ${ok.b} / ${alpha})`
}

/**
 * @example "rgb(20 80 120)"
 * @example "rgb(20 80 120 / 50%)"
 * @example "rgb(20 80 120 / 0.5)"
 */
export function rgbToCssString(c: RGB, alpha?: number): string {
  if (typeof alpha != 'number') return `rgb(${c[0]} ${c[1]} ${c[2]})`
  if (alpha > 1) return `rgb(${c[0]} ${c[1]} ${c[2]} / ${alpha}%)`
  return `rgb(${c[0]} ${c[1]} ${c[2]} / ${alpha})`
}

/**
 * Minimum and maximum L, a, and b values
 * (as seen from all the possible conversions from rgb)
 */

export const oklabRange = {
  L: {
    min: 0 as const,
    max: 0.9999999934735462 as const,
    range: 0.9999999934735462 as const,
  },
  a: {
    min: -0.23388757418790818 as const,
    max: 0.27621639742350523 as const,
    range: 0.5101039716114134 as const,
  },
  b: {
    min: -0.3115281476783751 as const,
    max: 0.19856975465179516 as const,
    range: 0.5100979023301703 as const,
  },
}

// gamma and gamma_inv from https://observablehq.com/@fil/oklab-color-space
// See: https://imagej.nih.gov/ij/developer/source/ij/process/ColorSpaceConverter.java.html
function gamma(x: number) {
  return x >= 0.0031308 ? 1.055 * Math.pow(x, 1 / 2.4) - 0.055 : 12.92 * x
}

function gamma_inv(x: number) {
  return x >= 0.04045 ? Math.pow((x + 0.055) / (1 + 0.055), 2.4) : x / 12.92
}
