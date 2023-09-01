import type { Direction } from './enums'

export type HorizontalEdgeProps = {
  direction: Direction | null
  left: number | null
  right: number | null
}

export type OverlapProps = {
  left: number | null
  right: number | null
}
