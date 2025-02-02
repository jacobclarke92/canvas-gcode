import { clamp } from './numberUtils'

export type RGB = [red: number, green: number, blue: number]
export type HSL = [hue: number, saturation: number, lightness: number]
export type Color = RGB | HSL

export const hexToRgb = (hex: string | number): RGB => {
  if (typeof hex === 'string') {
    const bigint = parseInt(hex.slice(1), 16)
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255]
  } else if (typeof hex === 'number') {
    return [0xff & (hex >> 16), 0xff & (hex >> 8), 0xff & (hex >> 0)]
  }
}

export const rgbToHex = (rgb: RGB): string => {
  return '#' + ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1)
}

export const sciColor = (val: number, minVal: number, maxVal: number): RGB => {
  const range = maxVal - minVal
  val = clamp(val, minVal, maxVal - 0.0001)
  val = range == 0.0 ? 0.5 : (val - minVal) / range
  const m = 0.25
  const num = Math.floor(val / m)
  const s = (val - num * m) / m
  let r, g, b
  switch (num) {
    case 0:
      r = 0.0
      g = s
      b = 1.0
      break
    case 1:
      r = 0.0
      g = 1.0
      b = 1.0 - s
      break
    case 2:
      r = s
      g = 1.0
      b = 0.0
      break
    case 3:
      r = 1.0
      g = 1.0 - s
      b = 0.0
      break
  }
  return [255 * r, 255 * g, 255 * b]
}
