import Point from './Point'

export type Vector = { x: number; y: number }

export type Edge = [Point, Point]

export type Line = [Point, Point]

export type OverloadedFunctionWithOptionals<MainParams extends any[], OptionalParams extends any[]> = (
  ...args: [...MainParams, ...OptionalParams] | [...MainParams]
) => void
