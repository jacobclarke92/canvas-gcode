export type RGB = [red: number, green: number, blue: number]
export type HSL = [hue: number, saturation: number, lightness: number]
export type Color = RGB | HSL

export const hexToRgb = (hex: string): RGB => {
  const bigint = parseInt(hex.slice(1), 16)
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255]
}

export const rgbToHex = (rgb: RGB): string => {
  return '#' + ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1)
}
