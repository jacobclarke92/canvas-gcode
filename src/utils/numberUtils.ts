export const randIntRange = (max: number, min: number = 0) => Math.round(Math.random() * (max - min) + min)
export const randFloatRange = (max: number, min: number = 0) => Math.random() * (max - min) + min
export const randInt = (range: number) => Math.round(Math.random() * (range * 2) - range)
export const randFloat = (range: number) => Math.random() * (range * 2) - range
export const wrap = (value: number, max: number, min: number = 0) => (value < min ? max : value > max ? min : value)
