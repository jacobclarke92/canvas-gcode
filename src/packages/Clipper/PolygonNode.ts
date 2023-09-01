import { Path } from './Path'

export class PolygonNode extends Array<PolygonNode> {
  public parent: PolygonNode | null = null
  public polygon: Path = new Path()
  protected index = 0
  public joinType = 0
  public endType = 0
  public children: PolygonNode[] = []
  public isOpen = false

  public isHoleNode() {
    let result = true
    let node = this.parent
    while (node !== null) {
      result = !result
      node = node.parent
    }
    return result
  }

  public childCount() {
    return this.children.length
  }

  public contour() {
    return this.polygon
  }

  public addChild(Child: PolygonNode) {
    const cnt = this.children.length
    this.children.push(Child)
    Child.parent = this
    Child.index = cnt
  }

  public getNext() {
    if (this.children.length > 0) return this.children[0]
    else return this.getNextSiblingUp()
  }

  public getNextSiblingUp(): PolygonNode | null {
    if (this.parent === null) return null
    else if (this.index === this.parent.children.length - 1) return this.parent.getNextSiblingUp()
    else return this.parent.children[this.index + 1]
  }

  public isHole() {
    return this.isHoleNode()
  }
}

export class PolygonTree extends PolygonNode {
  public allPolys: PolygonNode[] = []

  public clear() {
    for (let i = 0, len = this.allPolys.length; i < len; i++) this.allPolys[i] = null
    this.allPolys.length = 0
    this.children.length = 0
  }

  public getFirst() {
    if (this.children.length > 0) return this.children[0]
    else return null
  }

  public total() {
    let result = this.allPolys.length
    // with negative offsets, ignore the hidden outer polygon ...
    if (result > 0 && this.children[0] !== this.allPolys[0]) result--
    return result
  }
}
