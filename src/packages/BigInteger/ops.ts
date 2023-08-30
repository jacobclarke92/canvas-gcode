export type OpFunc = (x: number, y: number) => number

export const op_and: OpFunc = (x, y) => x & y

export const op_or: OpFunc = (x, y) => x | y

export const op_xor: OpFunc = (x, y) => x ^ y

export const op_andNot: OpFunc = (x, y) => x & ~y
