import { IntPoint } from './IntPoint'
import type { PolyNode } from './PolyNode'

export class LocalMinima {
  public Y = 0
  public LeftBound = null
  public RightBound = null
  public Next: LocalMinima | null = null
}

export class Scanbeam {
  public Y = 0
  public Next = null
}

export class Maxima {
  public X = 0
  public Next = null
  public Prev = null
}

// OutRec: contains a path in the clipping solution. Edges in the AEL will
// carry a pointer to an OutRec when they are part of the clipping solution.
export class OutRec {
  public Idx = 0
  public IsHole = false
  public IsOpen = false
  public FirstLeft = null // see comments in clipper.pas
  public Pts = null
  public BottomPt = null
  public PolyNode: PolyNode | null = null
}

export class OutPt {
  public Idx = 0
  public Pt = new IntPoint()
  public Next = null
  public Prev = null
}

export class Join {
  public OutPt1 = null
  public OutPt2 = null
  public OffPt = new IntPoint()
}
