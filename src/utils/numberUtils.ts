import { random } from './random'

export const randIntRange = (max: number, min: number = 0) => Math.round(random() * (max - min) + min)
export const randFloatRange = (max: number, min: number = 0) => random() * (max - min) + min
export const randInt = (range: number) => Math.round(random() * (range * 2) - range)
export const randFloat = (range: number) => random() * (range * 2) - range
export const wrap = (value: number, max: number, min: number = 0) => (value < min ? max : value > max ? min : value)
