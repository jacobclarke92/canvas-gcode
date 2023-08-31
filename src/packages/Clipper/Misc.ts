import type { Edge } from './Edge'
import { IntPoint } from './IntPoint'
import type { PolygonNode } from './PolygonNode'

export class LocalMinima {
  public y = 0
  public leftBoundary: Edge | null = null
  public rightBoundary: Edge | null = null
  public next: LocalMinima | null = null
  public v: LocalMinima | null = null
}

export class Scanbeam {
  public y = 0
  public Next: Scanbeam | null = null
  public v = 0
}

export class Maxima {
  public x = 0
  public next: Maxima | null = null
  public prev: Maxima | null = null
}

// OutRec: contains a path in the clipping solution. Edges in the AEL will
// carry a pointer to an OutRec when they are part of the clipping solution.
export class OuterRectangle {
  public index = 0
  public isHole = false
  public isOpen = false
  public firstLeft: OuterRectangle | null = null // see comments in clipper.pas
  public points: OuterPoint | null = null
  public bottomPoint: OuterPoint | null = null
  public polyNode: PolygonNode | null = null
}

export class OuterPoint {
  public index = 0
  public point = new IntPoint()
  public next: OuterPoint | null = null
  public prev: OuterPoint | null = null
}

export class Join {
  public outerPoint1: OuterPoint | null = null
  public outerPoint2: OuterPoint | null = null
  public offPoint = new IntPoint()
}
