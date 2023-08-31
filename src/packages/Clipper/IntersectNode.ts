import { IntPoint } from './IntPoint'
import type { TEdge } from './TEdge'

export class IntersectNode {
  public Edge1: TEdge | null = null
  public Edge2: TEdge | null = null
  public Pt = new IntPoint()
}

export class MyIntersectNodeSort {
  public static Compare(node1: IntersectNode, node2: IntersectNode) {
    const i = node2.Pt.Y - node1.Pt.Y
    if (i > 0) return 1
    else if (i < 0) return -1
    else return 0
  }
}
