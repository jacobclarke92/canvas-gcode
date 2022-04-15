import SubPath, {
  Action,
  ArcAction,
  BezierCurveToAction,
  EllipseAction,
  LineToAction,
  QuadraticCurveToAction,
} from './SubPath'
import { arcToPoints, samePos } from './utils/pathUtils'

import * as ClipperLib from './clipper_unminified'
import Point from './Point'

export type Bounds = {
  left: number
  top: number
  right: number
  bottom: number
}

export type WindingRule = 'evenodd' | 'nonzero' | 'positive' | 'negative'

export default class Path {
  public subPaths: SubPath[] = []
  static actions = SubPath.actions

  public current: SubPath

  public clone() {
    const copy = new Path()
    copy.subPaths = this.subPaths.slice(0)
    return copy
  }

  public moveTo(x: number, y: number) {
    const subPath = new SubPath()
    subPath.moveTo(x, y)
    this.subPaths.push(subPath)
    this.current = subPath
  }

  private ensure(x: number, y: number) {
    if (this.subPaths.length === 0) {
      this.moveTo(x, y)
    }
  }

  public close() {
    if (!this.current) return false
    this.current.close()
  }

  /**
   * Pass all curves straight through
   * */
  public lineTo(...args: LineToAction['args']) {
    this.ensure(...args)
    this.current.lineTo(...args)
  }
  public arc(...args: ArcAction['args']) {
    const [x, y, radius, startAngle, endAngle, antiClockwise] = args
    this.ellipse(x, y, radius, radius, startAngle, endAngle, antiClockwise)
  }
  public ellipse(...args: EllipseAction['args']) {
    const [aX, aY, xRadius, yRadius, aStartAngle, aEndAngle, antiClockwise] = args
    const points = arcToPoints(aX, aY, aStartAngle, aEndAngle, xRadius)

    // this.ensure(points.start.x, points.start.y);

    if (!this.current || !samePos(this.current.lastPoint(), points.start)) {
      this.lineTo(points.start.x, points.start.y)
    }

    this.current.ellipse(...args)
  }
  public quadraticCurveTo(...args: QuadraticCurveToAction['args']) {
    this.current.quadraticCurveTo(...args)
  }
  public bezierCurveTo(...args: BezierCurveToAction['args']) {
    this.current.bezierCurveTo(...args)
  }
  public rect(x: number, y: number, w: number, h: number) {
    this.moveTo(x, y)
    this.lineTo(x + w, y)
    this.lineTo(x + w, y + h)
    this.lineTo(x, y + h)
    this.lineTo(x, y)
  }

  public toPolys(scale: number, divisions?: number) {
    if (!scale) throw 'NO SCALE!'
    return this.subPaths.map((subPath) => subPath.toPoly(scale, divisions))
  }
  public fromPolys(polygons: { X: number; Y: number }[][], scale: number) {
    if (!scale) throw 'NO SCALE!'

    this.subPaths = []

    for (var i = 0, l = polygons.length; i < l; ++i) {
      var subPath = new SubPath()
      subPath.fromPolys(polygons[i], scale)
      this.subPaths.push(subPath)
      this.current = subPath
    }

    return this
  }
  public clip(clipRegion: Path, clipType?: ClipperLib.ClipType, divisions?: number) {
    if (!clipRegion) return this

    clipType = clipType || 0

    const scale = 1000

    // this.close();
    // clipRegion.close();

    const subjPolys = this.toPolys(scale, divisions)
    const clipPolys = clipRegion.toPolys(scale, divisions)

    // Clean both
    // var subjPolys = ClipperLib.Clipper.CleanPolygons(subjPolys, 1);
    // var clipPolys = ClipperLib.Clipper.CleanPolygons(clipPolys, 1);

    // var subjPolys = ClipperLib.Clipper.SimplifyPolygons(subjPolys, ClipperLib.PolyFillType.pftNonZero);

    // var clipPolys = ClipperLib.Clipper.SimplifyPolygons(clipPolys, ClipperLib.PolyFillType.pftNonZero);

    const cpr = new ClipperLib.Clipper()
    // var cpr = new Clipper()
    // cpr.PreserveCollinear = true;
    // cpr.ReverseSolution = true;

    // @ts-ignore
    cpr.AddPaths(subjPolys, ClipperLib.PolyType.ptSubject, true)
    // @ts-ignore
    cpr.AddPaths(clipPolys, ClipperLib.PolyType.ptClip, true)

    const clipped: any[] = []
    cpr.Execute(clipType, clipped)

    var path = new Path()
    path.fromPolys(clipped, scale)
    return path
  }

  public translate(x: number, y: number) {
    const result = new Path()
    this.subPaths.forEach(function (subPath) {
      const pts = subPath.getPoints()
      result.moveTo(pts[0].x + x, pts[0].y + y)
      pts.slice(1).forEach((p) => {
        result.lineTo(p.x + x, p.y + y)
      })
    })
    return result
  }

  public clipToBounds(bounds: Bounds) {
    const result = new Path()
    let p0 = new Point()
    let p0u = p0.clone()
    let p1u: Point

    this.subPaths.forEach(function (subPath) {
      const pts = subPath.getPoints()

      pts.forEach(function (p1, i) {
        p1 = p1.clone()
        p1u = p1.clone()

        // if(p1.y < bounds.top && p0.y < bounds.top) {
        //   return;
        // }
        // if(p1.x > bounds.right && p0.x > bounds.right) {
        //   return;
        // }

        if (p1.y < bounds.top) {
          var m = (p1.x - p0.x) / (p1.y - p0.y)
          p1.x += m * (bounds.top - p1.y) || 0
          p1.y = bounds.top
        } else if (p0u.y < bounds.top) {
          var m = (p1.x - p0u.x) / (p1.y - p0u.y)
          var x = m * (bounds.top - p1.y) || 0

          result.moveTo(p1.x + x, bounds.top)
        }

        // if(p1.x < bounds.left) {
        //   var m = (p1.y - p0.y) / (p1.x - p0.x);
        //   p1.y += m * (bounds.left - p1.x);
        //   p1.x = bounds.left;
        // }
        // else if(p0u.x < bounds.left) {
        //   var m = (p1.y - p0u.y) / (p1.x - p0u.x);
        //   var y = m * (bounds.left - p1.x);
        //   // result.moveTo(bounds.left, bounds.top);
        // }

        if (p1.x > bounds.right) {
          var m = (p1.y - p0.y) / (p1.x - p0.x)
          p1.y += m * (bounds.right - p1.x)
          p1.x = bounds.right
        } else if (p0u.x > bounds.right) {
          var m = (p1.y - p0u.y) / (p1.x - p0u.x)
          var y = m * (bounds.right - p1.x)

          // result.moveTo(bounds.right, p1.y-y);
        }

        if (i === 0) result.moveTo(p1.x, p1.y)
        else result.lineTo(p1.x, p1.y)

        p0 = p1
        p0u = p1u
      })
    })

    return result
  }

  public simplify(windingRule?: WindingRule, divisions?: number) {
    // Special case for single ellipse
    // just change the radius.
    // if(this.is('ellipse')) {
    //     var result = new Path();
    //     var args = this.subPaths[0].actions[1].args;

    //     result.ellipse(
    //       args[0],
    //       args[1],
    //       args[2],
    //       args[3],
    //       args[4],
    //       args[5],
    //       args[6]
    //     );

    //     return result;
    // }

    const scale = 1000
    let polys = this.toPolys(scale, divisions)
    let type = ClipperLib.PolyFillType.pftNonZero

    if (windingRule === 'evenodd') {
      type = ClipperLib.PolyFillType.pftEvenOdd
    }

    polys = ClipperLib.Clipper.SimplifyPolygons(polys, type)

    const result = new Path()
    result.fromPolys(polys, scale)

    return result
  }

  public is(actionType: Action['type']) {
    if (
      this.subPaths.length === 1 &&
      this.subPaths[0].actions.length === 2 &&
      this.subPaths[0].actions[1].type === actionType
    ) {
      return true
    }

    return false
  }

  public offset(delta: number, divisions?: number) {
    if (delta === 0) return this

    // Special case for single ellipse
    // just change the radius.
    if (this.is('ELLIPSE')) {
      const result = new Path()
      const action = this.subPaths[0].actions[1] as EllipseAction
      const args = action.args
      if (args[2] + delta < 0) return false
      result.ellipse(args[0], args[1], args[2] + delta, args[3] + delta, args[4], args[5], args[6])
      return result
    }

    const scale = 1000

    const polygons = this.toPolys(scale, divisions)

    // offset
    // var miterLimit = 1000 * scale

    var co = new ClipperLib.ClipperOffset()
    // co.PreserveCollinear = true;
    // co.ReverseSolution = true;

    co.AddPaths(polygons, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon)

    // TODO:
    const solution: any[] = []

    try {
      co.Execute(solution, delta * scale)
    } catch (err) {
      return false
    }

    if (!solution || solution.length === 0 || solution[0].length === 0) return false

    var result = new Path()
    result.fromPolys(solution, scale)

    result.close() // Not sure why I need to do this now
    return result
  }

  public ramp(depth: number) {}

  public addPath(path2: Path) {
    this.subPaths = this.subPaths.concat(path2.subPaths)
  }

  public estimateMaxOffset(divisions: number) {
    const bounds = this.getBounds()
    const width = Math.abs(bounds.right - bounds.left)
    const height = Math.abs(bounds.bottom - bounds.top)
    let lt = Math.min(width, height) / 2
    let gt = 0

    for (let i = 0; i < 5; ++i) {
      const test = gt + (lt - gt) / 2
      const offset = this.offset(-test, 3)

      if (offset) gt = test
      else lt = test
    }

    return { lt: lt, gt: gt }
  }

  public fillPath(diameter: number, divisions: number) {
    const result = new Path()
    const overlap = Math.sin(Math.PI / 4)

    // this.subPaths.forEach(function(sp) {
    // var path = sp.toPath();
    const path = this

    let max = path.estimateMaxOffset(5).lt
    max -= diameter / 2

    for (let i = -max; i < -diameter / 2; i += diameter * overlap) {
      let offsetPath = path.offset(i, divisions)
      if (!offsetPath) break
      offsetPath = offsetPath.reverse()
      result.addPath(offsetPath)
    }

    // Finishing pass
    const finish = path.offset(-diameter / 2, divisions)
    if (finish) result.addPath(finish.reverse())

    return result
  }

  public connectEnds(diameter: number) {
    for (let i = this.subPaths.length - 1; i > 0; --i) {
      let sp1 = this.subPaths[i - 1]
      let sp2 = this.subPaths[i]

      const p1 = sp1.lastPoint()
      const nearest = sp2.nearestPoint(p1)
      const p2 = nearest.point

      if (nearest.distance < diameter * 2) {
        sp2 = sp2.shift(nearest.i)
        sp1.lineTo(p2.x, p2.y)
        sp2.actions[0].type = 'LINE_TO'
        sp1.actions = sp1.actions.concat(sp2.actions)
        this.subPaths.splice(i, 1)
      }
    }

    return this
  }

  public reverse() {
    if (this.is('ELLIPSE')) {
      const result = new Path()
      const action = this.subPaths[0].actions[1] as EllipseAction
      const args = action.args

      result.ellipse(
        args[0],
        args[1],
        args[2],
        args[3],
        args[5], // end as start
        args[4], // start as end
        !args[6] // invert ccw
      )

      return result
    }

    const result = new Path()

    result.subPaths = this.subPaths.map((sp) => sp.reverse()).reverse()

    return result
  }

  public sort() {
    if (this.subPaths.length === 0) return this

    const copy = new Path()

    let p0 = this.subPaths[0].lastPoint()

    copy.subPaths = this.subPaths.sort((a, b) => {
      const p1 = a.lastPoint()
      const p2 = b.firstPoint()
      const d1 = Point.distance(p1, p0)
      const d2 = Point.distance(p2, p0)

      // Moving target
      p0 = b.lastPoint()

      if (d1 < d2) return -1
      if (d1 > d2) return 1

      return 0
    })

    return copy
  }

  public firstPoint() {
    if (!this.current) return false
    return this.subPaths[0].firstPoint()
  }

  public lastPoint() {
    if (!this.current) return false
    return this.subPaths[this.subPaths.length - 1].lastPoint()
  }

  public getPoints(divisions?: number): Point[] {
    var pts: Point[] = []
    this.subPaths.forEach((sp) => {
      pts.push(...sp.getPoints(divisions))
    })
    return pts
  }

  public getBounds(): Bounds {
    const pts = this.getPoints()
    const p0 = this.firstPoint() || new Point()
    const res: Bounds = {
      left: p0.x,
      top: p0.y,
      right: p0.x,
      bottom: p0.y,
    }

    pts.forEach((p) => {
      res.left = Math.min(res.left, p.x)
      res.top = Math.min(res.top, p.y)
      res.right = Math.max(res.right, p.x)
      res.bottom = Math.max(res.bottom, p.y)
    })

    return res
  }
}

// var NON_ZERO = ClipperLib.PolyFillType.pftNonZero
// var EVEN_ODD = ClipperLib.PolyFillType.pftEvenOdd
