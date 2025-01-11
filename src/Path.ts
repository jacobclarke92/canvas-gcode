import { Clipper } from './packages/Clipper/Clipper'
import { ClipperOffset } from './packages/Clipper/ClipperOffset'
import { ClipType, EndType, JoinType, PolyFillType, PolyType } from './packages/Clipper/enums'
import { Path as ClipperPath } from './packages/Clipper/Path'
import Point from './Point'
import type {
  Action,
  ArcAction,
  BezierCurveToAction,
  EllipseAction,
  GetPointsOpts,
  LineToAction,
  QuadraticCurveToAction,
} from './SubPath'
import SubPath from './SubPath'
import { arcToPoints, samePos } from './utils/pathUtils'

export type Bounds = {
  left: number
  top: number
  right: number
  bottom: number
}

export type WindingRule = 'evenodd' | 'nonzero' | 'positive' | 'negative'

export default class Path extends ClipperPath {
  public subPaths: SubPath[] = []
  public current: SubPath

  constructor(...args: [] | [points: Point[]]) {
    super()
    if (args.length === 1 && args[0].length > 0) {
      this.subPaths = [new SubPath(args[0])]
      this.current = this.subPaths[0]
    }
  }

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
      this.moveTo(points.start.x, points.start.y)
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

  public toPolygons(scale = 1, divisions?: number): Paths {
    if (!scale) throw 'NO SCALE!'
    const polygons = new Paths()
    for (const subPath of this.subPaths) {
      polygons.push(subPath.toPolygon(scale, divisions))
    }
    return polygons
  }

  public fromPolygons(polygons: Paths, scale = 1) {
    if (!scale) throw 'NO SCALE!'

    this.subPaths = []

    for (let i = 0, l = polygons.length; i < l; ++i) {
      const subPath = new SubPath()
      subPath.fromPolygon(polygons[i], scale)
      this.subPaths.push(subPath)
      this.current = subPath
    }

    return this
  }

  public clip(clipRegion: Path, clipType: ClipType = ClipType.intersection, divisions?: number) {
    if (!clipRegion) return this

    const scale = 1
    const subjectPolygons = this.toPolygons(scale, divisions)
    const clipPolygons = clipRegion.toPolygons(scale, divisions)

    // console.log(subjectPolygons)
    // console.log(clipPolygons)
    // Clean both
    // const subjPolys = Clipper.CleanPolygons(subjPolys, 1);
    // const clipPolys = Clipper.CleanPolygons(clipPolys, 1);
    // const subjPolys = Clipper.SimplifyPolygons(subjPolys, PolyFillType.pftNonZero);
    // const clipPolys = Clipper.SimplifyPolygons(clipPolys, PolyFillType.pftNonZero);

    const clipper = new Clipper()
    // clipper.preserveCollinear = true
    // clipper.reverseSolution = true

    clipper.addPaths(subjectPolygons, PolyType.subject, true)

    clipper.addPaths(clipPolygons, PolyType.clip, true)

    // debugger

    const clipped = new Paths()
    clipper.execute(clipType, clipped, PolyFillType.nonZero) // dunno if evenOdd is right: ;

    // console.log('clipped', clipped)

    const path = new Path()
    path.fromPolygons(clipped, scale)

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

    this.subPaths.forEach((subPath) => {
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
          const m = (p1.x - p0.x) / (p1.y - p0.y)
          p1.x += m * (bounds.top - p1.y) || 0
          p1.y = bounds.top
        } else if (p0u.y < bounds.top) {
          const m = (p1.x - p0u.x) / (p1.y - p0u.y)
          const x = m * (bounds.top - p1.y) || 0

          result.moveTo(p1.x + x, bounds.top)
        }

        // if(p1.x < bounds.left) {
        //   const m = (p1.y - p0.y) / (p1.x - p0.x);
        //   p1.y += m * (bounds.left - p1.x);
        //   p1.x = bounds.left;
        // }
        // else if(p0u.x < bounds.left) {
        //   const m = (p1.y - p0u.y) / (p1.x - p0u.x);
        //   const y = m * (bounds.left - p1.x);
        //   // result.moveTo(bounds.left, bounds.top);
        // }

        if (p1.x > bounds.right) {
          const m = (p1.y - p0.y) / (p1.x - p0.x)
          p1.y += m * (bounds.right - p1.x)
          p1.x = bounds.right
        } else if (p0u.x > bounds.right) {
          // const m = (p1.y - p0u.y) / (p1.x - p0u.x)
          // const y = m * (bounds.right - p1.x)
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
    // Special case for single ellipse just change the radius.
    // if(this.is('ellipse')) {
    //     const result = new Path();
    //     const args = this.subPaths[0].actions[1].args;
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
    let polys = this.toPolygons(scale, divisions)
    let type = PolyFillType.nonZero

    if (windingRule === 'evenodd') {
      type = PolyFillType.evenOdd
    }

    polys = Clipper.simplifyPolygons(polys, type) as Paths

    const result = new Path()
    result.fromPolygons(polys, scale)

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

    const polygons = this.toPolygons(scale, divisions)

    // offset
    // const miterLimit = 1000 * scale

    const co = new ClipperOffset()
    // co.PreserveCollinear = true;
    // co.ReverseSolution = true;

    co.addPaths(polygons, JoinType.miter, EndType.closedPolygon)

    // TODO:
    const solution = new Paths()

    try {
      co.execute(solution, delta * scale)
    } catch (err) {
      return false
    }

    if (!solution || solution.length === 0 || solution[0].length === 0) return false

    const result = new Path()
    result.fromPolygons(solution, scale)

    result.close() // Not sure why I need to do this now
    return result
  }

  public ramp(depth: number) {
    //
  }

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

    let max = this.estimateMaxOffset(5).lt
    max -= diameter / 2

    for (let i = -max; i < -diameter / 2; i += diameter * overlap) {
      let offsetPath = this.offset(i, divisions)
      if (!offsetPath) break
      offsetPath = offsetPath.reverse()
      result.addPath(offsetPath)
    }

    // Finishing pass
    const finish = this.offset(-diameter / 2, divisions)
    if (finish) result.addPath(finish.reverse())

    return result
  }

  public connectEnds(diameter: number) {
    for (let i = this.subPaths.length - 1; i > 0; --i) {
      const sp1 = this.subPaths[i - 1]
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

  public sortCustom() {
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

  public getPoints(divisionsOrOpts?: number | GetPointsOpts): Point[] {
    const pts: Point[] = []
    this.subPaths.forEach((sp) => {
      pts.push(...sp.getPoints(divisionsOrOpts))
    })
    return pts
  }

  public getPointGroups(divisionsOrOpts?: number | GetPointsOpts): Point[][] {
    const ptGroups: Point[][] = []
    this.subPaths.forEach((sp) => {
      ptGroups.push(sp.getPoints(divisionsOrOpts))
    })
    return ptGroups
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

export class Paths extends Array<Path> {
  public push: typeof Array.prototype.push
  constructor() {
    super()
    this.push = Array.prototype.push
    return []
  }
}
