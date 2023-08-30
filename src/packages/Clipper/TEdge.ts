import { EdgeSide, PolyType } from './enums'
import { IntPoint } from './IntPoint'

export class TEdge {
  public Bot = new IntPoint()
  public Curr = new IntPoint() //current (updated for every new scanbeam)
  public Top = new IntPoint()
  public Delta = new IntPoint()
  public Dx = 0
  public PolyTyp = PolyType.ptSubject
  public Side = EdgeSide.esLeft // side only refers to current side of solution poly
  public WindDelta: 1 | 0 | -1 = 0 // 1 or -1 depending on winding direction
  public WindCnt = 0
  public WindCnt2 = 0 // winding count of the opposite polytype
  public OutIdx = 0
  public Next: TEdge | null = null
  public Prev: TEdge | null = null
  public NextInLML: TEdge | null = null
  public NextInAEL: TEdge | null = null
  public PrevInAEL: TEdge | null = null
  public NextInSEL: TEdge | null = null
  public PrevInSEL: TEdge | null = null
}
