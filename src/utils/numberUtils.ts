import { random } from './random'

export const randIntRange = (max: number, min: number = 0): number => Math.round(random() * (max - min) + min)
export const randFloatRange = (max: number, min: number = 0): number => random() * (max - min) + min
export const randInt = (range: number): number => Math.round(random() * (range * 2) - range)
export const randFloat = (range: number): number => random() * (range * 2) - range
export const wrap = (value: number, max: number, min: number = 0): number =>
  value < min ? max : value > max ? min : value

export const countDecimals = (number: number, most: number = 8): number => {
  for (let n = 1, count = 0; count < most; count++, n /= 10) {
    if (number % n === 0) return count
  }
  return most
}

export const floatString = (number: number, decimals: number = 5): string => {
  if (number % 1 === 0) return String(number)
  const decimalsCount = Math.min(countDecimals(number, decimals), decimals)
  return decimalsCount === 0 ? String(Math.round(number)) : number.toFixed(decimalsCount)
}

// normalizes any angle to be between -PI and PI
export const normalizeRadian = (radian: number): number => ((radian + Math.PI) % (Math.PI * 2)) - Math.PI

export const segmentValue = (segments: number, totalSegments: number, max: number, min: number = 0): number =>
  ((max - min) / totalSegments) * segments

export const degToRad = (deg: number): number => (deg * Math.PI) / 180
export const radToDeg = (rad: number): number => (rad * 180) / Math.PI
