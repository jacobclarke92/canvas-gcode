export const randInt = (max: number, min: number = 0) => Math.round(Math.random() * (max - min) + min)
export const randFloat = (max: number, min: number = 0) => Math.random() * (max - min) + min
export const wrap = (value: number, max: number, min: number = 0) => (value < min ? max : value > max ? min : value)
