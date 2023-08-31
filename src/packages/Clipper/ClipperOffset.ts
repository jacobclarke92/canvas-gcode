import { ClipperLib } from '.'
import { Clipper } from './Clipper'
import { ClipperBase } from './ClipperBase'
import { DoublePoint } from './DoublePoint'
import { ClipType, EndType, JoinType, PolyFillType, PolyType } from './enums'
import { IntPoint } from './IntPoint'
import { Path, Paths } from './Path'
import { PolyNode, PolyTree } from './PolyNode'

export class ClipperOffset {
  public m_destPolys = new Paths()
  public m_srcPoly = new Path()
  public m_destPoly = new Path()
  public m_normals: DoublePoint[] = []
  public m_delta = 0
  public m_sinA = 0
  public m_sin = 0
  public m_cos = 0
  public m_miterLim = 0
  public m_StepsPerRad = 0
  public m_lowest = new IntPoint()
  public m_polyNodes = new PolyNode()
  public MiterLimit: number
  public ArcTolerance: number

  public static Round = Clipper.Round

  constructor(miterLimit = 2, arcTolerance = ClipperOffset.def_arc_tolerance) {
    this.m_lowest.X = -1
    this.MiterLimit = miterLimit
    this.ArcTolerance = arcTolerance
  }

  public static two_pi = 6.28318530717959
  public static def_arc_tolerance = 0.25
  public Clear() {
    ClipperLib.Clear(this.m_polyNodes.Childs())
    this.m_lowest.X = -1
  }

  public AddPath(path: Path, joinType: JoinType, endType: EndType) {
    let highI = path.length - 1
    if (highI < 0) return
    const newNode = new PolyNode()
    newNode.m_jointype = joinType
    newNode.m_endtype = endType
    //strip duplicate points from path and also get index to the lowest point ...
    if (endType === EndType.etClosedLine || endType === EndType.etClosedPolygon)
      while (highI > 0 && IntPoint.op_Equality(path[0], path[highI])) highI--
    //newNode.m_polygon.set_Capacity(highI + 1);
    newNode.m_polygon.push(path[0])
    let j = 0,
      k = 0
    for (let i = 1; i <= highI; i++)
      if (IntPoint.op_Inequality(newNode.m_polygon[j], path[i])) {
        j++
        newNode.m_polygon.push(path[i])
        if (
          path[i].Y > newNode.m_polygon[k].Y ||
          (path[i].Y === newNode.m_polygon[k].Y && path[i].X < newNode.m_polygon[k].X)
        )
          k = j
      }
    if (endType === EndType.etClosedPolygon && j < 2) return

    this.m_polyNodes.AddChild(newNode)
    //if this path's lowest pt is lower than all the others then update m_lowest
    if (endType !== EndType.etClosedPolygon) return
    if (this.m_lowest.X < 0) this.m_lowest = new IntPoint(this.m_polyNodes.ChildCount() - 1, k)
    else {
      const ip = this.m_polyNodes.Childs()[this.m_lowest.X].m_polygon[this.m_lowest.Y]
      if (newNode.m_polygon[k].Y > ip.Y || (newNode.m_polygon[k].Y === ip.Y && newNode.m_polygon[k].X < ip.X))
        this.m_lowest = new IntPoint(this.m_polyNodes.ChildCount() - 1, k)
    }
  }

  public AddPaths(paths: Paths, joinType: JoinType, endType: EndType) {
    for (let i = 0, ilen = paths.length; i < ilen; i++) this.AddPath(paths[i], joinType, endType)
  }

  public FixOrientations() {
    //fixup orientations of all closed paths if the orientation of the
    //closed path with the lowermost vertex is wrong ...
    if (this.m_lowest.X >= 0 && !Clipper.Orientation(this.m_polyNodes.Childs()[this.m_lowest.X].m_polygon)) {
      for (let i = 0; i < this.m_polyNodes.ChildCount(); i++) {
        const node = this.m_polyNodes.Childs()[i]
        if (
          node.m_endtype === EndType.etClosedPolygon ||
          (node.m_endtype === EndType.etClosedLine && Clipper.Orientation(node.m_polygon))
        )
          node.m_polygon.reverse()
      }
    } else {
      for (let i = 0; i < this.m_polyNodes.ChildCount(); i++) {
        const node = this.m_polyNodes.Childs()[i]
        if (node.m_endtype === EndType.etClosedLine && !Clipper.Orientation(node.m_polygon)) node.m_polygon.reverse()
      }
    }
  }

  public static GetUnitNormal(pt1: IntPoint, pt2: IntPoint) {
    let dx = pt2.X - pt1.X
    let dy = pt2.Y - pt1.Y
    if (dx === 0 && dy === 0) return new DoublePoint(0, 0)
    const f = 1 / Math.sqrt(dx * dx + dy * dy)
    dx *= f
    dy *= f
    return new DoublePoint(dy, -dx)
  }

  public DoOffset(delta: number) {
    this.m_destPolys = []
    this.m_delta = delta
    //if Zero offset, just copy any CLOSED polygons to m_p and return ...
    if (ClipperBase.near_zero(delta)) {
      //this.m_destPolys.set_Capacity(this.m_polyNodes.ChildCount);
      for (let i = 0; i < this.m_polyNodes.ChildCount(); i++) {
        const node = this.m_polyNodes.Childs()[i]
        if (node.m_endtype === EndType.etClosedPolygon) this.m_destPolys.push(node.m_polygon)
      }
      return
    }
    // see offset_trigonometry3.svg in the documentation folder ...
    if (this.MiterLimit > 2) this.m_miterLim = 2 / (this.MiterLimit * this.MiterLimit)
    else this.m_miterLim = 0.5

    let y: number
    if (this.ArcTolerance <= 0) y = ClipperOffset.def_arc_tolerance
    else if (this.ArcTolerance > Math.abs(delta) * ClipperOffset.def_arc_tolerance)
      y = Math.abs(delta) * ClipperOffset.def_arc_tolerance
    else y = this.ArcTolerance

    // see offset_trigonometry2.svg in the documentation folder ...
    const steps = 3.14159265358979 / Math.acos(1 - y / Math.abs(delta))
    this.m_sin = Math.sin(ClipperOffset.two_pi / steps)
    this.m_cos = Math.cos(ClipperOffset.two_pi / steps)
    this.m_StepsPerRad = steps / ClipperOffset.two_pi
    if (delta < 0) this.m_sin = -this.m_sin
    //this.m_destPolys.set_Capacity(this.m_polyNodes.ChildCount * 2);

    for (let i = 0; i < this.m_polyNodes.ChildCount(); i++) {
      const node = this.m_polyNodes.Childs()[i]
      this.m_srcPoly = node.m_polygon
      const len = this.m_srcPoly.length
      if (len === 0 || (delta <= 0 && (len < 3 || node.m_endtype !== EndType.etClosedPolygon))) continue
      this.m_destPoly = []
      if (len === 1) {
        if (node.m_jointype === JoinType.jtRound) {
          let X = 1,
            Y = 0
          for (let j = 1; j <= steps; j++) {
            this.m_destPoly.push(
              new IntPoint(
                ClipperOffset.Round(this.m_srcPoly[0].X + X * delta),
                ClipperOffset.Round(this.m_srcPoly[0].Y + Y * delta)
              )
            )
            const X2 = X
            X = X * this.m_cos - this.m_sin * Y
            Y = X2 * this.m_sin + Y * this.m_cos
          }
        } else {
          let X = -1,
            Y = -1
          for (let j = 0; j < 4; ++j) {
            this.m_destPoly.push(
              new IntPoint(
                ClipperOffset.Round(this.m_srcPoly[0].X + X * delta),
                ClipperOffset.Round(this.m_srcPoly[0].Y + Y * delta)
              )
            )
            if (X < 0) X = 1
            else if (Y < 0) Y = 1
            else X = -1
          }
        }
        this.m_destPolys.push(this.m_destPoly)
        continue
      }

      // build m_normals ...
      this.m_normals.length = 0

      // this.m_normals.set_Capacity(len);
      for (let j = 0; j < len - 1; j++)
        this.m_normals.push(ClipperOffset.GetUnitNormal(this.m_srcPoly[j], this.m_srcPoly[j + 1]))

      if (node.m_endtype === EndType.etClosedLine || node.m_endtype === EndType.etClosedPolygon)
        this.m_normals.push(ClipperOffset.GetUnitNormal(this.m_srcPoly[len - 1], this.m_srcPoly[0]))
      else this.m_normals.push(new DoublePoint(this.m_normals[len - 2]))

      if (node.m_endtype === EndType.etClosedPolygon) {
        let k = len - 1
        for (let j = 0; j < len; j++) k = this.OffsetPoint(j, k, node.m_jointype)
        this.m_destPolys.push(this.m_destPoly)
      } else if (node.m_endtype === EndType.etClosedLine) {
        let k = len - 1
        for (let j = 0; j < len; j++) k = this.OffsetPoint(j, k, node.m_jointype)
        this.m_destPolys.push(this.m_destPoly)
        this.m_destPoly = []
        //re-build m_normals ...
        const n = this.m_normals[len - 1]
        for (let j = len - 1; j > 0; j--)
          this.m_normals[j] = new DoublePoint(-this.m_normals[j - 1].X, -this.m_normals[j - 1].Y)
        this.m_normals[0] = new DoublePoint(-n.X, -n.Y)
        k = 0
        for (let j = len - 1; j >= 0; j--) k = this.OffsetPoint(j, k, node.m_jointype)
        this.m_destPolys.push(this.m_destPoly)
      } else {
        let k = 0
        for (let j = 1; j < len - 1; ++j) k = this.OffsetPoint(j, k, node.m_jointype)
        let pt1
        if (node.m_endtype === EndType.etOpenButt) {
          const j = len - 1
          pt1 = new IntPoint(
            ClipperOffset.Round(this.m_srcPoly[j].X + this.m_normals[j].X * delta),
            ClipperOffset.Round(this.m_srcPoly[j].Y + this.m_normals[j].Y * delta)
          )
          this.m_destPoly.push(pt1)
          pt1 = new IntPoint(
            ClipperOffset.Round(this.m_srcPoly[j].X - this.m_normals[j].X * delta),
            ClipperOffset.Round(this.m_srcPoly[j].Y - this.m_normals[j].Y * delta)
          )
          this.m_destPoly.push(pt1)
        } else {
          const j = len - 1
          k = len - 2
          this.m_sinA = 0
          this.m_normals[j] = new DoublePoint(-this.m_normals[j].X, -this.m_normals[j].Y)
          if (node.m_endtype === EndType.etOpenSquare) this.DoSquare(j, k)
          else this.DoRound(j, k)
        }
        // re-build m_normals ...
        for (let j = len - 1; j > 0; j--)
          this.m_normals[j] = new DoublePoint(-this.m_normals[j - 1].X, -this.m_normals[j - 1].Y)
        this.m_normals[0] = new DoublePoint(-this.m_normals[1].X, -this.m_normals[1].Y)
        k = len - 1
        for (let j = k - 1; j > 0; --j) k = this.OffsetPoint(j, k, node.m_jointype)
        if (node.m_endtype === EndType.etOpenButt) {
          pt1 = new IntPoint(
            ClipperOffset.Round(this.m_srcPoly[0].X - this.m_normals[0].X * delta),
            ClipperOffset.Round(this.m_srcPoly[0].Y - this.m_normals[0].Y * delta)
          )
          this.m_destPoly.push(pt1)
          pt1 = new IntPoint(
            ClipperOffset.Round(this.m_srcPoly[0].X + this.m_normals[0].X * delta),
            ClipperOffset.Round(this.m_srcPoly[0].Y + this.m_normals[0].Y * delta)
          )
          this.m_destPoly.push(pt1)
        } else {
          k = 1
          this.m_sinA = 0
          if (node.m_endtype === EndType.etOpenSquare) this.DoSquare(0, 1)
          else this.DoRound(0, 1)
        }
        this.m_destPolys.push(this.m_destPoly)
      }
    }
  }

  public Execute(...args: [p: PolyTree] | [solution: PolyNode, delta: number]) {
    if (!(args[0] instanceof PolyTree)) {
      // function (solution, delta)
      const [solution, delta] = args
      ClipperLib.Clear(solution)
      this.FixOrientations()
      this.DoOffset(delta)
      //now clean up 'corners' ...
      const clpr = new Clipper(0)
      clpr.AddPaths(this.m_destPolys, PolyType.ptSubject, true)
      if (delta > 0) {
        clpr.Execute(ClipType.ctUnion, solution, PolyFillType.pftPositive, PolyFillType.pftPositive)
      } else {
        const r = Clipper.GetBounds(this.m_destPolys)
        const outer = new Path()
        outer.push(new IntPoint(r.left - 10, r.bottom + 10))
        outer.push(new IntPoint(r.right + 10, r.bottom + 10))
        outer.push(new IntPoint(r.right + 10, r.top - 10))
        outer.push(new IntPoint(r.left - 10, r.top - 10))
        clpr.AddPath(outer, PolyType.ptSubject, true)
        clpr.ReverseSolution = true
        clpr.Execute(ClipType.ctUnion, solution, PolyFillType.pftNegative, PolyFillType.pftNegative)
        if (solution.length > 0) solution.splice(0, 1)
      }
      //console.log(JSON.stringify(solution));
    } // function (polytree, delta)
    else {
      const [solution, delta] = args
      solution.Clear()
      this.FixOrientations()
      this.DoOffset(delta)
      //now clean up 'corners' ...
      const clpr = new Clipper(0)
      clpr.AddPaths(this.m_destPolys, PolyType.ptSubject, true)
      if (delta > 0) {
        clpr.Execute(ClipType.ctUnion, solution, PolyFillType.pftPositive, PolyFillType.pftPositive)
      } else {
        const r = Clipper.GetBounds(this.m_destPolys)
        const outer = new Path()
        outer.push(new IntPoint(r.left - 10, r.bottom + 10))
        outer.push(new IntPoint(r.right + 10, r.bottom + 10))
        outer.push(new IntPoint(r.right + 10, r.top - 10))
        outer.push(new IntPoint(r.left - 10, r.top - 10))
        clpr.AddPath(outer, PolyType.ptSubject, true)
        clpr.ReverseSolution = true
        clpr.Execute(ClipType.ctUnion, solution, PolyFillType.pftNegative, PolyFillType.pftNegative)
        //remove the outer PolyNode rectangle ...
        if (solution.ChildCount() === 1 && solution.Childs()[0].ChildCount() > 0) {
          const outerNode = solution.Childs()[0]
          //solution.Childs.set_Capacity(outerNode.ChildCount);
          solution.Childs()[0] = outerNode.Childs()[0]
          solution.Childs()[0].m_Parent = solution
          for (let i = 1; i < outerNode.ChildCount(); i++) solution.AddChild(outerNode.Childs()[i])
        } else solution.Clear()
      }
    }
  }

  public OffsetPoint(j: number, k: number, jointype: JoinType) {
    // cross product ...
    this.m_sinA = this.m_normals[k].X * this.m_normals[j].Y - this.m_normals[j].X * this.m_normals[k].Y

    if (Math.abs(this.m_sinA * this.m_delta) < 1.0) {
      // dot product ...
      const cosA = this.m_normals[k].X * this.m_normals[j].X + this.m_normals[j].Y * this.m_normals[k].Y
      if (cosA > 0) {
        // angle ==> 0 degrees
        this.m_destPoly.push(
          new IntPoint(
            ClipperOffset.Round(this.m_srcPoly[j].X + this.m_normals[k].X * this.m_delta),
            ClipperOffset.Round(this.m_srcPoly[j].Y + this.m_normals[k].Y * this.m_delta)
          )
        )
        return k
      }
      // else angle ==> 180 degrees
    } else if (this.m_sinA > 1) this.m_sinA = 1.0
    else if (this.m_sinA < -1) this.m_sinA = -1.0

    if (this.m_sinA * this.m_delta < 0) {
      this.m_destPoly.push(
        new IntPoint(
          ClipperOffset.Round(this.m_srcPoly[j].X + this.m_normals[k].X * this.m_delta),
          ClipperOffset.Round(this.m_srcPoly[j].Y + this.m_normals[k].Y * this.m_delta)
        )
      )
      this.m_destPoly.push(new IntPoint(this.m_srcPoly[j]))
      this.m_destPoly.push(
        new IntPoint(
          ClipperOffset.Round(this.m_srcPoly[j].X + this.m_normals[j].X * this.m_delta),
          ClipperOffset.Round(this.m_srcPoly[j].Y + this.m_normals[j].Y * this.m_delta)
        )
      )
    } else {
      switch (jointype) {
        case JoinType.jtMiter: {
          const r = 1 + (this.m_normals[j].X * this.m_normals[k].X + this.m_normals[j].Y * this.m_normals[k].Y)
          if (r >= this.m_miterLim) this.DoMiter(j, k, r)
          else this.DoSquare(j, k)
          break
        }
        case JoinType.jtSquare:
          this.DoSquare(j, k)
          break
        case JoinType.jtRound:
          this.DoRound(j, k)
          break
      }
    }

    k = j
    return k
  }

  public DoSquare(j: number, k: number) {
    const dx = Math.tan(
      Math.atan2(this.m_sinA, this.m_normals[k].X * this.m_normals[j].X + this.m_normals[k].Y * this.m_normals[j].Y) / 4
    )
    this.m_destPoly.push(
      new IntPoint(
        ClipperOffset.Round(this.m_srcPoly[j].X + this.m_delta * (this.m_normals[k].X - this.m_normals[k].Y * dx)),
        ClipperOffset.Round(this.m_srcPoly[j].Y + this.m_delta * (this.m_normals[k].Y + this.m_normals[k].X * dx))
      )
    )
    this.m_destPoly.push(
      new IntPoint(
        ClipperOffset.Round(this.m_srcPoly[j].X + this.m_delta * (this.m_normals[j].X + this.m_normals[j].Y * dx)),
        ClipperOffset.Round(this.m_srcPoly[j].Y + this.m_delta * (this.m_normals[j].Y - this.m_normals[j].X * dx))
      )
    )
  }

  public DoMiter(j: number, k: number, r: number) {
    const q = this.m_delta / r
    this.m_destPoly.push(
      new IntPoint(
        ClipperOffset.Round(this.m_srcPoly[j].X + (this.m_normals[k].X + this.m_normals[j].X) * q),
        ClipperOffset.Round(this.m_srcPoly[j].Y + (this.m_normals[k].Y + this.m_normals[j].Y) * q)
      )
    )
  }

  public DoRound(j: number, k: number) {
    const a = Math.atan2(
      this.m_sinA,
      this.m_normals[k].X * this.m_normals[j].X + this.m_normals[k].Y * this.m_normals[j].Y
    )

    const steps = Math.max(ClipperLib.Cast_Int32(ClipperOffset.Round(this.m_StepsPerRad * Math.abs(a))), 1)

    let X = this.m_normals[k].X,
      Y = this.m_normals[k].Y,
      X2
    for (let i = 0; i < steps; ++i) {
      this.m_destPoly.push(
        new IntPoint(
          ClipperOffset.Round(this.m_srcPoly[j].X + X * this.m_delta),
          ClipperOffset.Round(this.m_srcPoly[j].Y + Y * this.m_delta)
        )
      )
      X2 = X
      X = X * this.m_cos - this.m_sin * Y
      Y = X2 * this.m_sin + Y * this.m_cos
    }
    this.m_destPoly.push(
      new IntPoint(
        ClipperOffset.Round(this.m_srcPoly[j].X + this.m_normals[j].X * this.m_delta),
        ClipperOffset.Round(this.m_srcPoly[j].Y + this.m_normals[j].Y * this.m_delta)
      )
    )
  }
}
