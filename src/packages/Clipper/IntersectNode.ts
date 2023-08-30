export class IntersectNode {
  public Edge1 = null
  public Edge2 = null
  public Pt = new IntPoint()
}

export class MyIntersectNodeSort {
  public Compare = function (node1, node2) {
    const i = node2.Pt.Y - node1.Pt.Y
    if (i > 0) return 1
    else if (i < 0) return -1
    else return 0
  }
}
