import { IntPoint } from './IntPoint'
import type { PolyNode } from './PolyNode'
import type { TEdge } from './TEdge'

export class LocalMinima {
  public Y = 0
  public LeftBound: TEdge | null = null
  public RightBound: TEdge | null = null
  public Next: LocalMinima | null = null
  public v: LocalMinima | null = null
}

export class Scanbeam {
  public Y = 0
  public Next: Scanbeam | null = null
  public v = 0
}

export class Maxima {
  public X = 0
  public Next: Maxima | null = null
  public Prev: Maxima | null = null
}

// OutRec: contains a path in the clipping solution. Edges in the AEL will
// carry a pointer to an OutRec when they are part of the clipping solution.
export class OutRec {
  public Idx = 0
  public IsHole = false
  public IsOpen = false
  public FirstLeft: OutRec | null = null // see comments in clipper.pas
  public Pts: OutPt | null = null
  public BottomPt: OutPt | null = null
  public PolyNode: PolyNode | null = null
}

export class OutPt {
  public Idx = 0
  public Pt = new IntPoint()
  public Next: OutPt | null = null
  public Prev: OutPt | null = null
}

export class Join {
  public OutPt1: OutPt | null = null
  public OutPt2: OutPt | null = null
  public OffPt = new IntPoint()
}
