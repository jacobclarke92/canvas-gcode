import { EdgeSide, PolyType } from './enums'
import { IntPoint } from './IntPoint'

export class TEdge {
  public bottom = new IntPoint()
  public current = new IntPoint() //current (updated for every new scanbeam)
  public top = new IntPoint()
  public delta = new IntPoint()
  public dx = 0
  public polyType = PolyType.subject
  public side = EdgeSide.left // side only refers to current side of solution poly
  public windDelta: 1 | 0 | -1 = 0 // 1 or -1 depending on winding direction
  public windCount = 0
  public windCount2 = 0 // winding count of the opposite polytype
  public outIndex = 0
  public next: TEdge | null = null
  public prev: TEdge | null = null
  public nextInLML: TEdge | null = null
  public nextInAEL: TEdge | null = null
  public prevInAEL: TEdge | null = null
  public nextInSEL: TEdge | null = null
  public prevInSEL: TEdge | null = null
  public v: TEdge | null = null
}
