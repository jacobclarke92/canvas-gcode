import { deg180, deg360 } from '../constants/angles'
import { random } from './random'

/** random int between min and max (min is 0 by default) */
export const randIntRange = (max: number, min = 0): number =>
  Math.round(random() * (max - min) + min)

/** random float between min and max (min is 0 by default) */
export const randFloatRange = (max: number, min = 0): number => random() * (max - min) + min

/** random int between -range and range */
export const randInt = (range: number): number => Math.round(random() * (range * 2) - range)

/** random float between -range and range */
export const randFloat = (range: number): number => random() * (range * 2) - range

export const randBool = (): boolean => random() > 0.5
export const flipCoin = randBool

/** sign function */
export const sign = (x: number): -1 | 1 => (x < 0.0 ? -1 : 1)

/** clamp value between min and max */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(value, min))

/** wraps value around within range, e.g. val: -2, range: 0 - 5, return: 3 */
export const wrap = (value: number, max: number, min = 0): number => {
  const range = max - min
  const val = ((value - min) % range) + min
  return val === min && value > min ? min + range : val
}

/** maps a value from one range to another */
export const mapRange = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number => {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin
}

/** if splitting a total into segments, this offers a quick way to get the value at a certain index */
export const segmentValue = (index: number, segments: number, max: number, min = 0): number =>
  ((max - min) / segments) * index

/** converts degree to radian */
export const degToRad = (deg: number): number => (deg * Math.PI) / 180

/** converts radian to degree */
export const radToDeg = (rad: number, round?: boolean): number => {
  const angle = (rad * 180) / Math.PI
  return round ? Math.round(angle) : angle
}

/** normalizes any angle to be between -PI and PI */
export const normalizeRadian = (radian: number): number => ((radian + deg180) % deg360) - deg180

/** counts how many decimals a number has, default max of 8  */
export const countDecimals = (number: number, most = 8): number => {
  for (let n = 1, count = 0; count < most; count++, n /= 10) {
    if (number % n === 0) return count
  }
  return most
}

/** convert float to string, default decimals is 5 */
export const floatString = (number: number, decimals = 5): string => {
  if (number % 1 === 0) return String(number)
  const decimalsCount = Math.min(countDecimals(number, decimals), decimals)
  return decimalsCount === 0 ? String(Math.round(number)) : number.toFixed(decimalsCount)
}

/** compares two angles and gets the difference (normalized) */
export const angleDiff = (startAngle: number, endAngle: number) =>
  ((endAngle - startAngle + deg360 + deg180) % deg360) - deg180

/** similar to angleDiff but is always positive */
export const smallestAngleDiff = (a1: number, a2: number): number =>
  deg180 - Math.abs(Math.abs(a1 - a2) - deg180)
