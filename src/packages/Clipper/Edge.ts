import { EdgeSide, PolyType } from './enums'
import { IntPoint } from './IntPoint'

export class Edge {
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
  public next: Edge | null = null
  public prev: Edge | null = null
  public nextInLML: Edge | null = null
  public nextInAEL: Edge | null = null
  public prevInAEL: Edge | null = null
  public nextInSEL: Edge | null = null
  public prevInSEL: Edge | null = null
  public v: Edge | null = null
}
