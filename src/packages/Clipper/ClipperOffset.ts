import { ClipperLib } from '.'
import { Clipper } from './Clipper'
import { ClipperBase } from './ClipperBase'
import { DoublePoint } from './DoublePoint'
import { ClipType, EndType, JoinType, PolyFillType, PolyType } from './enums'
import { IntPoint } from './IntPoint'
import { Path, Paths } from './Path'
import type { PolygonTree } from './PolygonNode'
import { PolygonNode } from './PolygonNode'

export class ClipperOffset {
  protected destinationPolygons = new Paths()
  protected sourcePolygon = new Path()
  protected destinationPolygon = new Path()
  protected normals: DoublePoint[] = []
  protected delta = 0
  protected sinA = 0
  protected sin = 0
  protected cos = 0
  protected miterLim = 0
  protected stepsPerRad = 0
  protected lowestPoint = new IntPoint()
  protected polygonNodes = new PolygonNode()
  public miterLimit: number
  public arcTolerance: number

  public static round = Clipper.round

  constructor(miterLimit = 2, arcTolerance = ClipperOffset.DEF_ARC_TOLERANCE) {
    this.lowestPoint.x = -1
    this.miterLimit = miterLimit
    this.arcTolerance = arcTolerance
  }

  public static TWO_PI = 6.28318530717959
  public static DEF_ARC_TOLERANCE = 0.25

  public clear() {
    ClipperLib.clear(this.polygonNodes.children)
    this.lowestPoint.x = -1
  }

  public addPath(path: Path, joinType: JoinType, endType: EndType) {
    let highIndex = path.length - 1
    if (highIndex < 0) return
    const newNode = new PolygonNode()
    newNode.joinType = joinType
    newNode.endType = endType
    //strip duplicate points from path and also get index to the lowest point ...
    if (endType === EndType.closedLine || endType === EndType.closedPolygon)
      while (highIndex > 0 && IntPoint.op_Equality(path[0], path[highIndex])) highIndex--
    //newNode.m_polygon.set_Capacity(highI + 1);
    newNode.polygon.push(path[0])
    let j = 0,
      k = 0
    for (let i = 1; i <= highIndex; i++)
      if (IntPoint.op_Inequality(newNode.polygon[j], path[i])) {
        j++
        newNode.polygon.push(path[i])
        if (
          path[i].y > newNode.polygon[k].y ||
          (path[i].y === newNode.polygon[k].y && path[i].x < newNode.polygon[k].x)
        )
          k = j
      }
    if (endType === EndType.closedPolygon && j < 2) return

    this.polygonNodes.addChild(newNode)
    //if this path's lowest pt is lower than all the others then update m_lowest
    if (endType !== EndType.closedPolygon) return
    if (this.lowestPoint.x < 0) this.lowestPoint = new IntPoint(this.polygonNodes.childCount() - 1, k)
    else {
      const ip = this.polygonNodes.children[this.lowestPoint.x].polygon[this.lowestPoint.y]
      if (newNode.polygon[k].y > ip.y || (newNode.polygon[k].y === ip.y && newNode.polygon[k].x < ip.x))
        this.lowestPoint = new IntPoint(this.polygonNodes.childCount() - 1, k)
    }
  }

  public addPaths(paths: Paths, joinType: JoinType, endType: EndType) {
    for (let i = 0, len = paths.length; i < len; i++) this.addPath(paths[i], joinType, endType)
  }

  public fixOrientations() {
    // fixup orientations of all closed paths if the orientation of the
    // closed path with the lowermost vertex is wrong ...
    if (this.lowestPoint.x >= 0 && !Clipper.orientation(this.polygonNodes.children[this.lowestPoint.x].polygon)) {
      for (let i = 0; i < this.polygonNodes.childCount(); i++) {
        const node = this.polygonNodes.children[i]
        if (
          node.endType === EndType.closedPolygon ||
          (node.endType === EndType.closedLine && Clipper.orientation(node.polygon))
        )
          node.polygon.reverse()
      }
    } else {
      for (let i = 0; i < this.polygonNodes.childCount(); i++) {
        const node = this.polygonNodes.children[i]
        if (node.endType === EndType.closedLine && !Clipper.orientation(node.polygon)) node.polygon.reverse()
      }
    }
  }

  public static getUnitNormal(pt1: IntPoint, pt2: IntPoint) {
    let dx = pt2.x - pt1.x
    let dy = pt2.y - pt1.y
    if (dx === 0 && dy === 0) return new DoublePoint(0, 0)
    const f = 1 / Math.sqrt(dx * dx + dy * dy)
    dx *= f
    dy *= f
    return new DoublePoint(dy, -dx)
  }

  public doOffset(delta: number) {
    this.destinationPolygons = []
    this.delta = delta

    //if Zero offset, just copy any CLOSED polygons to m_p and return ...
    if (ClipperBase.isNearZero(delta)) {
      //this.m_destPolys.set_Capacity(this.m_polyNodes.ChildCount);
      for (let i = 0; i < this.polygonNodes.childCount(); i++) {
        const node = this.polygonNodes.children[i]
        if (node.endType === EndType.closedPolygon) this.destinationPolygons.push(node.polygon)
      }
      return
    }

    // see offset_trigonometry3.svg in the documentation folder ...
    if (this.miterLimit > 2) this.miterLim = 2 / (this.miterLimit * this.miterLimit)
    else this.miterLim = 0.5

    let y: number
    if (this.arcTolerance <= 0) y = ClipperOffset.DEF_ARC_TOLERANCE
    else if (this.arcTolerance > Math.abs(delta) * ClipperOffset.DEF_ARC_TOLERANCE)
      y = Math.abs(delta) * ClipperOffset.DEF_ARC_TOLERANCE
    else y = this.arcTolerance

    // see offset_trigonometry2.svg in the documentation folder ...
    const steps = 3.14159265358979 / Math.acos(1 - y / Math.abs(delta))
    this.sin = Math.sin(ClipperOffset.TWO_PI / steps)
    this.cos = Math.cos(ClipperOffset.TWO_PI / steps)
    this.stepsPerRad = steps / ClipperOffset.TWO_PI
    if (delta < 0) this.sin = -this.sin
    //this.m_destPolys.set_Capacity(this.m_polyNodes.ChildCount * 2);

    for (let i = 0; i < this.polygonNodes.childCount(); i++) {
      const node = this.polygonNodes.children[i]
      this.sourcePolygon = node.polygon
      const len = this.sourcePolygon.length
      if (len === 0 || (delta <= 0 && (len < 3 || node.endType !== EndType.closedPolygon))) continue
      this.destinationPolygon = []
      if (len === 1) {
        if (node.joinType === JoinType.round) {
          let X = 1,
            Y = 0
          for (let j = 1; j <= steps; j++) {
            this.destinationPolygon.push(
              new IntPoint(
                ClipperOffset.round(this.sourcePolygon[0].x + X * delta),
                ClipperOffset.round(this.sourcePolygon[0].y + Y * delta)
              )
            )
            const X2 = X
            X = X * this.cos - this.sin * Y
            Y = X2 * this.sin + Y * this.cos
          }
        } else {
          let X = -1,
            Y = -1
          for (let j = 0; j < 4; ++j) {
            this.destinationPolygon.push(
              new IntPoint(
                ClipperOffset.round(this.sourcePolygon[0].x + X * delta),
                ClipperOffset.round(this.sourcePolygon[0].y + Y * delta)
              )
            )
            if (X < 0) X = 1
            else if (Y < 0) Y = 1
            else X = -1
          }
        }
        this.destinationPolygons.push(this.destinationPolygon)
        continue
      }

      // build m_normals ...
      this.normals.length = 0

      // this.m_normals.set_Capacity(len);
      for (let j = 0; j < len - 1; j++)
        this.normals.push(ClipperOffset.getUnitNormal(this.sourcePolygon[j], this.sourcePolygon[j + 1]))

      if (node.endType === EndType.closedLine || node.endType === EndType.closedPolygon)
        this.normals.push(ClipperOffset.getUnitNormal(this.sourcePolygon[len - 1], this.sourcePolygon[0]))
      else this.normals.push(new DoublePoint(this.normals[len - 2]))

      if (node.endType === EndType.closedPolygon) {
        let k = len - 1
        for (let j = 0; j < len; j++) k = this.offsetPoint(j, k, node.joinType)
        this.destinationPolygons.push(this.destinationPolygon)
      } else if (node.endType === EndType.closedLine) {
        let k = len - 1
        for (let j = 0; j < len; j++) k = this.offsetPoint(j, k, node.joinType)
        this.destinationPolygons.push(this.destinationPolygon)
        this.destinationPolygon = []
        //re-build m_normals ...
        const n = this.normals[len - 1]
        for (let j = len - 1; j > 0; j--)
          this.normals[j] = new DoublePoint(-this.normals[j - 1].x, -this.normals[j - 1].y)
        this.normals[0] = new DoublePoint(-n.x, -n.y)
        k = 0
        for (let j = len - 1; j >= 0; j--) k = this.offsetPoint(j, k, node.joinType)
        this.destinationPolygons.push(this.destinationPolygon)
      } else {
        let k = 0
        for (let j = 1; j < len - 1; ++j) k = this.offsetPoint(j, k, node.joinType)
        let pt1
        if (node.endType === EndType.openButt) {
          const j = len - 1
          pt1 = new IntPoint(
            ClipperOffset.round(this.sourcePolygon[j].x + this.normals[j].x * delta),
            ClipperOffset.round(this.sourcePolygon[j].y + this.normals[j].y * delta)
          )
          this.destinationPolygon.push(pt1)
          pt1 = new IntPoint(
            ClipperOffset.round(this.sourcePolygon[j].x - this.normals[j].x * delta),
            ClipperOffset.round(this.sourcePolygon[j].y - this.normals[j].y * delta)
          )
          this.destinationPolygon.push(pt1)
        } else {
          const j = len - 1
          k = len - 2
          this.sinA = 0
          this.normals[j] = new DoublePoint(-this.normals[j].x, -this.normals[j].y)
          if (node.endType === EndType.openSquare) this.doSquare(j, k)
          else this.doRound(j, k)
        }
        // re-build m_normals ...
        for (let j = len - 1; j > 0; j--)
          this.normals[j] = new DoublePoint(-this.normals[j - 1].x, -this.normals[j - 1].y)
        this.normals[0] = new DoublePoint(-this.normals[1].x, -this.normals[1].y)
        k = len - 1
        for (let j = k - 1; j > 0; --j) k = this.offsetPoint(j, k, node.joinType)
        if (node.endType === EndType.openButt) {
          pt1 = new IntPoint(
            ClipperOffset.round(this.sourcePolygon[0].x - this.normals[0].x * delta),
            ClipperOffset.round(this.sourcePolygon[0].y - this.normals[0].y * delta)
          )
          this.destinationPolygon.push(pt1)
          pt1 = new IntPoint(
            ClipperOffset.round(this.sourcePolygon[0].x + this.normals[0].x * delta),
            ClipperOffset.round(this.sourcePolygon[0].y + this.normals[0].y * delta)
          )
          this.destinationPolygon.push(pt1)
        } else {
          k = 1
          this.sinA = 0
          if (node.endType === EndType.openSquare) this.doSquare(0, 1)
          else this.doRound(0, 1)
        }
        this.destinationPolygons.push(this.destinationPolygon)
      }
    }
  }

  public execute(...args: [p: PolygonTree] | [solution: PolygonTree, delta: number]) {
    const [solution, delta] = args
    solution.clear()
    this.fixOrientations()
    this.doOffset(delta)
    //now clean up 'corners' ...
    const clipper = new Clipper(0)
    clipper.addPaths(this.destinationPolygons, PolyType.subject, true)
    if (delta > 0) {
      clipper.execute(ClipType.union, solution, PolyFillType.positive, PolyFillType.positive)
    } else {
      const r = Clipper.getBounds(this.destinationPolygons)
      const outer = new Path()
      outer.push(new IntPoint(r.left - 10, r.bottom + 10))
      outer.push(new IntPoint(r.right + 10, r.bottom + 10))
      outer.push(new IntPoint(r.right + 10, r.top - 10))
      outer.push(new IntPoint(r.left - 10, r.top - 10))
      clipper.addPath(outer, PolyType.subject, true)
      clipper.reverseSolution = true
      clipper.execute(ClipType.union, solution, PolyFillType.negative, PolyFillType.negative)
      //remove the outer PolyNode rectangle ...
      if (solution.childCount() === 1 && solution.children[0].childCount() > 0) {
        const outerNode = solution.children[0]
        //solution.Childs.set_Capacity(outerNode.ChildCount);
        solution.children[0] = outerNode.children[0]
        solution.children[0].parent = solution
        for (let i = 1; i < outerNode.childCount(); i++) solution.addChild(outerNode.children[i])
      } else solution.clear()
    }
  }

  public offsetPoint(j: number, k: number, joinType: JoinType) {
    // cross product ...
    this.sinA = this.normals[k].x * this.normals[j].y - this.normals[j].x * this.normals[k].y

    if (Math.abs(this.sinA * this.delta) < 1.0) {
      // dot product ...
      const cosA = this.normals[k].x * this.normals[j].x + this.normals[j].y * this.normals[k].y
      if (cosA > 0) {
        // angle ==> 0 degrees
        this.destinationPolygon.push(
          new IntPoint(
            ClipperOffset.round(this.sourcePolygon[j].x + this.normals[k].x * this.delta),
            ClipperOffset.round(this.sourcePolygon[j].y + this.normals[k].y * this.delta)
          )
        )
        return k
      }
      // else angle ==> 180 degrees
    } else if (this.sinA > 1) this.sinA = 1.0
    else if (this.sinA < -1) this.sinA = -1.0

    if (this.sinA * this.delta < 0) {
      this.destinationPolygon.push(
        new IntPoint(
          ClipperOffset.round(this.sourcePolygon[j].x + this.normals[k].x * this.delta),
          ClipperOffset.round(this.sourcePolygon[j].y + this.normals[k].y * this.delta)
        )
      )
      this.destinationPolygon.push(new IntPoint(this.sourcePolygon[j]))
      this.destinationPolygon.push(
        new IntPoint(
          ClipperOffset.round(this.sourcePolygon[j].x + this.normals[j].x * this.delta),
          ClipperOffset.round(this.sourcePolygon[j].y + this.normals[j].y * this.delta)
        )
      )
    } else {
      switch (joinType) {
        case JoinType.miter: {
          const r = 1 + (this.normals[j].x * this.normals[k].x + this.normals[j].y * this.normals[k].y)
          if (r >= this.miterLim) this.doMiter(j, k, r)
          else this.doSquare(j, k)
          break
        }
        case JoinType.square:
          this.doSquare(j, k)
          break
        case JoinType.round:
          this.doRound(j, k)
          break
      }
    }

    k = j
    return k
  }

  public doSquare(j: number, k: number) {
    const dx = Math.tan(
      Math.atan2(this.sinA, this.normals[k].x * this.normals[j].x + this.normals[k].y * this.normals[j].y) / 4
    )
    this.destinationPolygon.push(
      new IntPoint(
        ClipperOffset.round(this.sourcePolygon[j].x + this.delta * (this.normals[k].x - this.normals[k].y * dx)),
        ClipperOffset.round(this.sourcePolygon[j].y + this.delta * (this.normals[k].y + this.normals[k].x * dx))
      )
    )
    this.destinationPolygon.push(
      new IntPoint(
        ClipperOffset.round(this.sourcePolygon[j].x + this.delta * (this.normals[j].x + this.normals[j].y * dx)),
        ClipperOffset.round(this.sourcePolygon[j].y + this.delta * (this.normals[j].y - this.normals[j].x * dx))
      )
    )
  }

  public doMiter(j: number, k: number, r: number) {
    const q = this.delta / r
    this.destinationPolygon.push(
      new IntPoint(
        ClipperOffset.round(this.sourcePolygon[j].x + (this.normals[k].x + this.normals[j].x) * q),
        ClipperOffset.round(this.sourcePolygon[j].y + (this.normals[k].y + this.normals[j].y) * q)
      )
    )
  }

  public doRound(j: number, k: number) {
    const a = Math.atan2(this.sinA, this.normals[k].x * this.normals[j].x + this.normals[k].y * this.normals[j].y)

    const steps = Math.max(ClipperLib.Cast_Int32(ClipperOffset.round(this.stepsPerRad * Math.abs(a))), 1)

    let X = this.normals[k].x,
      Y = this.normals[k].y,
      X2
    for (let i = 0; i < steps; ++i) {
      this.destinationPolygon.push(
        new IntPoint(
          ClipperOffset.round(this.sourcePolygon[j].x + X * this.delta),
          ClipperOffset.round(this.sourcePolygon[j].y + Y * this.delta)
        )
      )
      X2 = X
      X = X * this.cos - this.sin * Y
      Y = X2 * this.sin + Y * this.cos
    }
    this.destinationPolygon.push(
      new IntPoint(
        ClipperOffset.round(this.sourcePolygon[j].x + this.normals[j].x * this.delta),
        ClipperOffset.round(this.sourcePolygon[j].y + this.normals[j].y * this.delta)
      )
    )
  }
}
