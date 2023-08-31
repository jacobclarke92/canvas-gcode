import type { Direction } from './enums'

export type HorizontalEdgeProps = {
  Dir: Direction | null
  Left: number | null
  Right: number | null
}

export type OverlapProps = {
  Left: number | null
  Right: number | null
}
