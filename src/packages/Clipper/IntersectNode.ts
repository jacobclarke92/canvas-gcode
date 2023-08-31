import { IntPoint } from './IntPoint'
import type { TEdge } from './TEdge'

export class IntersectNode {
  public edge1: TEdge | null = null
  public edge2: TEdge | null = null
  public point = new IntPoint()
}

export class MyIntersectNodeSort {
  public static compare(node1: IntersectNode, node2: IntersectNode) {
    const i = node2.point.y - node1.point.y
    if (i > 0) return 1
    else if (i < 0) return -1
    else return 0
  }
}
