import { Path } from './Path'

// TODO: NOT SURE IF extends Array<self> is correct
export class PolyNode extends Array<PolyNode> {
  public m_Parent: PolyNode | null = null
  public m_polygon: Path = new Path()
  public m_Index = 0
  public m_jointype = 0
  public m_endtype = 0
  public m_Childs: PolyNode[] = []
  public IsOpen = false

  public IsHoleNode() {
    let result = true
    let node = this.m_Parent
    while (node !== null) {
      result = !result
      node = node.m_Parent
    }
    return result
  }

  public ChildCount() {
    return this.m_Childs.length
  }

  public Contour() {
    return this.m_polygon
  }

  public AddChild(Child: PolyNode) {
    const cnt = this.m_Childs.length
    this.m_Childs.push(Child)
    Child.m_Parent = this
    Child.m_Index = cnt
  }

  public GetNext() {
    if (this.m_Childs.length > 0) return this.m_Childs[0]
    else return this.GetNextSiblingUp()
  }

  public GetNextSiblingUp(): PolyNode | null {
    if (this.m_Parent === null) return null
    else if (this.m_Index === this.m_Parent.m_Childs.length - 1) return this.m_Parent.GetNextSiblingUp()
    else return this.m_Parent.m_Childs[this.m_Index + 1]
  }

  public Childs() {
    return this.m_Childs
  }

  public Parent() {
    return this.m_Parent
  }

  public IsHole() {
    return this.IsHoleNode()
  }
}

export class PolyTree extends PolyNode {
  public m_AllPolys: PolyNode[] = []

  public Clear() {
    for (let i = 0, len = this.m_AllPolys.length; i < len; i++) this.m_AllPolys[i] = null
    this.m_AllPolys.length = 0
    this.m_Childs.length = 0
  }

  public GetFirst() {
    if (this.m_Childs.length > 0) return this.m_Childs[0]
    else return null
  }

  public Total() {
    let result = this.m_AllPolys.length
    // with negative offsets, ignore the hidden outer polygon ...
    if (result > 0 && this.m_Childs[0] !== this.m_AllPolys[0]) result--
    return result
  }
}
