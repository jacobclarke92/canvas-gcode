/**
 * Derived from code originally written by zz85 for three.js
 * http://www.lab4games.net/zz85/blog
 * Thanks zz85!
 **/

import Path from './Path'
import Point from './Point'
import { arcToPoints, ellipseToPoints, EPSILON, samePos } from './utils/pathUtils'

export type MoveToAction = {
  type: 'MOVE_TO'
  args: [x: number, y: number]
}

export type LineToAction = {
  type: 'LINE_TO'
  args: [x: number, y: number]
}

export type DotAction = {
  type: 'DOT'
  args: [x: number, y: number, pauseMs: number]
}

export type QuadraticCurveToAction = {
  type: 'QUADRATIC_CURVE_TO'
  args: [aCPx: number, aCPy: number, aX: number, aY: number]
}

export type BezierCurveToAction = {
  type: 'BEZIER_CURVE_TO'
  args: [aCP1x: number, aCP1y: number, aCP2x: number, aCP2y: number, aX: number, aY: number]
}

export type ArcAction = {
  type: 'ARC'
  args: [
    aX: number,
    aY: number,
    aRadius: number,
    aStartAngle: number,
    aEndAngle: number,
    antiClockwise: boolean
  ]
}

export type EllipseAction = {
  type: 'ELLIPSE'
  args: [
    aX: number,
    aY: number,
    xRadius: number,
    yRadius: number,
    aStartAngle: number,
    aEndAngle: number,
    antiClockwise: boolean
  ]
}

export type Action =
  | MoveToAction
  | LineToAction
  | DotAction
  | QuadraticCurveToAction
  | BezierCurveToAction
  // | ArcAction
  | EllipseAction

export const actions = {
  MOVE_TO: 'moveTo',
  LINE_TO: 'lineTo',
  QUADRATIC_CURVE_TO: 'quadraticCurveTo',
  BEZIER_CURVE_TO: 'bezierCurveTo',
  ELLIPSE: 'ellipse',
} as const

export const DEFAULT_DIVISIONS = 128

export type GetPointsOpts = {
  divisions?: number
  interpolateLines?: boolean
}

export default class SubPath {
  public actions: Action[] = []
  public pointsCache: Record<number, Point[]> = {}
  public hasBeenCutInto = false

  constructor(points?: Point[]) {
    if (points) this.fromPoints(points)
  }

  public clone() {
    const path = new SubPath()
    path.actions = this.actions.slice(0)
    return path
  }

  public isClosed(limit = EPSILON) {
    // console.log('isClosed Pts:', this.firstPoint(), this.lastPoint())
    return samePos(this.firstPoint(), this.lastPoint(), limit)
  }

  public get closed() {
    return this.isClosed()
  }

  public offset(delta: number) {
    const tmp = this.toPath().offset(delta)
    if (!tmp) return false
    return tmp.subPaths[0]
  }

  public simplify() {
    const tmp = this.toPath().simplify()
    if (!tmp) return false
    return tmp.subPaths[0]
  }

  public toPath() {
    const clone = this.clone()
    const path = new Path()
    path.subPaths.push(clone)
    path.current = path.subPaths[path.subPaths.length - 1]
    return path
  }

  public addAction(action: Action) {
    this.actions.push(action)
    this.pointsCache = []
  }

  public firstPoint() {
    const cachedPts = this.pointsCache[DEFAULT_DIVISIONS]
    if (this.hasBeenCutInto && cachedPts?.length) {
      return cachedPts[0]
    } else {
      let p = new Point(0, 0)
      const action = this.actions[0]
      if (!action) {
        // console.warn('No actions in SubPath->firstPoint', this)
        return p
      }

      switch (action.type) {
        case 'ELLIPSE':
          const [aX, aY, xRadius, yRadius, aStartAngle, aEndAngle, antiClockwise] = action.args
          p = arcToPoints(aX, aY, aStartAngle, aEndAngle, xRadius, yRadius).start
          break

        case 'MOVE_TO': {
          const [x, y] = action.args
          p.x = x
          p.y = y
          break
        }

        case 'DOT':
        case 'BEZIER_CURVE_TO':
        case 'QUADRATIC_CURVE_TO':
        case 'LINE_TO': {
          console.warn(action.type + ' cannot be first action!')
          break
        }

        default: {
          console.warn('Unknown type unaccounted for in SubPath->firstPoint')
        }
      }
      return p
    }
  }

  public lastPoint() {
    const cachedPts = this.pointsCache[DEFAULT_DIVISIONS]
    if (this.hasBeenCutInto && cachedPts?.length) {
      return cachedPts[cachedPts.length - 1]
    } else {
      let p = new Point(0, 0)
      const action = this.actions[this.actions.length - 1]
      if (!action) {
        // console.warn('No actions in SubPath->lastPoint', this)
        return p
      }

      switch (action.type) {
        case 'ELLIPSE': {
          const [aX, aY, xRadius, yRadius, aStartAngle, aEndAngle, antiClockwise] = action.args
          p = arcToPoints(aX, aY, aStartAngle, aEndAngle, xRadius, yRadius).end
          break
        }

        case 'BEZIER_CURVE_TO': {
          const [aCP1x, aCP1y, aCP2x, aCP2y, aX, aY] = action.args
          p.x = aX
          p.y = aY
          break
        }

        case 'QUADRATIC_CURVE_TO': {
          const [aCPx, aCPy, aX, aY] = action.args
          p.x = aX
          p.y = aY
          break
        }

        case 'DOT':
        case 'LINE_TO':
        case 'MOVE_TO': {
          const [x, y] = action.args
          p.x = x
          p.y = y
          break
        }

        default: {
          console.warn('Unknown type unaccounted for in SubPath->lastPoint')
        }
      }

      return p
    }
  }

  public fromPoints(points: Point[]) {
    this.moveTo(points[0].x, points[0].y)

    for (let v = 1, vLen = points.length; v < vLen; v++) {
      this.lineTo(points[v].x, points[v].y)
    }
  }

  public getActionLength(x0: number, y0: number, i: number) {
    const action = this.actions[i]
    switch (action.type) {
      case 'ELLIPSE': {
        const [aX, aY, xRadius, yRadius, aStartAngle, aEndAngle, antiClockwise] = action.args
        action.args
        // TODO: this seems a bit too simplistic to be real
        return (aEndAngle - aStartAngle) * yRadius
      }
      // case 'ARC': {
      //   const [aX, aY, aRadius, aStartAngle, aEndAngle, antiClockwise] = action.args
      //   // TODO: this seems a bit too simplistic to be real
      //   return (aEndAngle - aStartAngle) * aRadius
      // }
      default: {
        const args = action.args
        const x = args[args.length - 2]
        const y = args[args.length - 1]
        const xo = x - x0
        const yo = y - y0
        return Math.sqrt(xo * xo + yo * yo)
      }
    }
  }

  public getLength() {
    let len = 0
    const first = this.firstPoint()
    const pts = this.getPoints()
    for (let i = 1, l = pts.length; i < l; ++i) {
      const p = pts[i]
      const x1 = first.x
      const y1 = first.y
      const x2 = p.x
      const y2 = p.y
      const xo = x2 - x1
      const yo = y2 - y1
      len += Math.sqrt(xo * xo + yo * yo)
    }
    return len
  }

  public nearestPoint(p1: Point) {
    const p2 = new Point()
    let rn: number
    let rp: Point
    let rd = Infinity

    this.actions.forEach((action, n) => {
      switch (action.type) {
        case 'ELLIPSE': {
          const [aX, aY, xRadius, yRadius, aStartAngle, aEndAngle, antiClockwise] = action.args
          p2.x = aX + xRadius * Math.cos(aStartAngle) // copilot suggested the rad*cos
          p2.y = aY + yRadius * Math.sin(aStartAngle) // copilot suggested the rad*sin
          break
        }
        // case 'ARC': {
        //   const [aX, aY, aRadius, aStartAngle, aEndAngle, antiClockwise] = action.args
        //   p2.x = aX + aRadius * Math.cos(aStartAngle) // copilot suggested the rad*cos
        //   p2.y = aY + aRadius * Math.sin(aStartAngle) // copilot suggested the rad*sin
        //   break
        // }
        default: {
          p2.x = action.args[action.args.length - 2]
          p2.y = action.args[action.args.length - 1]
        }
      }

      const d = Point.distance(p1, p2)
      if (d < rd) {
        rn = n
        rp = p2.clone()
        rd = d
      }
    })

    return {
      i: rn,
      distance: rd,
      point: rp,
    }
  }

  public pointAt(index: number) {
    const p = new Point()
    const action = this.actions[index]
    switch (action.type) {
      case 'LINE_TO':
        p.x = action.args[action.args.length - 2]
        p.y = action.args[action.args.length - 1]
        break
      //TODO: THERE should be more cases no??
    }
    return p
  }

  public shiftToNearest(x: number, y: number) {
    const nearest = this.nearestPoint(new Point(x, y))
    return this.shift(nearest.i)
  }

  public shift(an: number) {
    if (an === 0) return this

    const result = new SubPath()

    result.actions = this.actions.slice(an).concat(this.actions.slice(0, an))

    result.actions.forEach((action) => {
      action.type = 'LINE_TO'
    })

    result.lineTo(result.actions[0].args[0], result.actions[0].args[1])

    return result
  }

  /**
   * my drawing machine shits the bed after doing a couple of thousand lineTo's
   * so have to break them up and start a new line at some point
   */
  private lineToCount = 0

  public moveTo(...args: MoveToAction['args']) {
    this.lineToCount = 0
    this.addAction({ type: 'MOVE_TO', args })
  }

  public lineTo(...args: LineToAction['args']) {
    this.lineToCount++
    this.addAction({ type: 'LINE_TO', args })
    if (this.lineToCount > 8000) {
      this.lineToCount = 0
      this.moveTo(...args)
    }
  }

  public quadraticCurveTo(...args: QuadraticCurveToAction['args']) {
    this.addAction({ type: 'QUADRATIC_CURVE_TO', args })
  }

  public bezierCurveTo(...args: BezierCurveToAction['args']) {
    this.addAction({ type: 'BEZIER_CURVE_TO', args })
  }

  public arc(...args: EllipseAction['args']) {
    this.ellipse(...args)
  }

  public ellipse(...args: EllipseAction['args']) {
    this.addAction({ type: 'ELLIPSE', args })
  }

  public getPoints(
    optsOrDivisions: number | GetPointsOpts = {
      divisions: DEFAULT_DIVISIONS,
      interpolateLines: false,
    }
  ): Point[] {
    const divisions =
      typeof optsOrDivisions === 'number' ? optsOrDivisions : optsOrDivisions.divisions
    const interpolateLines =
      typeof optsOrDivisions === 'number' ? false : optsOrDivisions.interpolateLines
    if (this.pointsCache[divisions]) return this.pointsCache[divisions]

    const points: Point[] = []

    for (let i = 0, il = this.actions.length; i < il; i++) {
      const action = this.actions[i]

      switch (action.type) {
        case 'MOVE_TO':
          points.push(new Point(action.args[0], action.args[1]))
          break

        case 'LINE_TO':
          if (interpolateLines) {
            const startPt = points[points.length - 1]
            const endPt = new Point(action.args[0], action.args[1])
            const dist = startPt.distanceTo(endPt)

            if (dist < 0.2) {
              points.push(endPt)
              break
            }

            // augment divisions based on actual distance so as to not over-complicate small curves
            const actualDivisions = Math.max(1, Math.ceil(dist / (divisions / 15)))

            const spacing = dist / actualDivisions
            for (let j = 1; j <= actualDivisions; j++) {
              points.push(startPt.clone().moveTowards(endPt, j * spacing))
            }
          } else {
            points.push(new Point(action.args[0], action.args[1]))
          }
          break

        case 'QUADRATIC_CURVE_TO': {
          let cpx0: number, cpy0: number
          const [aCPx, aCPy, aX, aY] = action.args

          if (points.length > 0) {
            const lastE = points[points.length - 1]

            cpx0 = lastE.x
            cpy0 = lastE.y
          } else {
            // TODO: this doesn't make much sense ....
            const lastAction = this.actions[i - 1]

            if (/*lastAction.type !== 'ARC' && */ lastAction.type !== 'ELLIPSE') {
              const lastE = lastAction.args

              cpx0 = lastE[lastE.length - 2]
              cpy0 = lastE[lastE.length - 1]
            } else {
              // TODO: I GUESSED THESE
              cpx0 = lastAction.args[0]
              cpy0 = lastAction.args[1]
            }
          }

          // augment divisions based on actual distance so as to not over-complicate small curves
          const dist =
            new Point(cpx0, cpy0).distanceTo(new Point(aCPx, aCPy)) +
            new Point(aCPx, aCPy).distanceTo(new Point(aX, aY))
          const actualDivisions = Math.max(2, Math.ceil(dist / (divisions / 30)))
          // Math.min(divisions, Math.ceil(dist * 2.5))

          for (let j = 1; j <= actualDivisions; j++) {
            const t = j / actualDivisions

            const tx = b2(t, cpx0, aCPx, aX)
            const ty = b2(t, cpy0, aCPy, aY)

            points.push(new Point(tx, ty))
          }

          break
        }

        case 'BEZIER_CURVE_TO': {
          let cpx0: number, cpy0: number
          //   let cpx, cpy, cpx2, cpy2, cpx1, cpy1, , lastE, j, t, tx, ty
          const [aCP1x, aCP1y, aCP2x, aCP2y, aX, aY] = action.args

          if (points.length > 0) {
            const lastE = points[points.length - 1]

            cpx0 = lastE.x
            cpy0 = lastE.y
          } else {
            const lastAction = this.actions[i - 1]
            if (/*lastAction.type !== 'ARC' && */ lastAction.type !== 'ELLIPSE') {
              const lastE = lastAction.args

              cpx0 = lastE[lastE.length - 2]
              cpy0 = lastE[lastE.length - 1]
            } else {
              // TODO: I GUESSED THESE
              cpx0 = lastAction.args[0]
              cpy0 = lastAction.args[1]
            }
          }

          // augment divisions based on actual distance so as to not over-complicate small curves
          const dists: number[] = []
          dists.push(new Point(cpx0, cpy0).distanceTo(new Point(aCP1x, aCP1y)))
          dists.push(new Point(aCP1x, aCP1y).distanceTo(new Point(aCP2x, aCP2y)))
          dists.push(new Point(aCP2x, aCP2y).distanceTo(new Point(aX, aY)))
          const dist = dists.reduce((a, b) => a + b, 0)
          const actualDivisions = Math.max(2, Math.ceil(dist / (divisions / 30)))
          // Math.min(divisions, Math.ceil(dist * 2.5))

          for (let j = 1; j <= actualDivisions; j++) {
            const t = j / actualDivisions

            const tx = b3(t, cpx0, aCP1x, aCP2x, aX)
            const ty = b3(t, cpy0, aCP1y, aCP2y, aY)

            points.push(new Point(tx, ty))
          }

          break
        }

        case 'ELLIPSE': {
          const [aX, aY, xRadius, yRadius, aStartAngle, aEndAngle, antiClockwise] = action.args
          points.push(
            ...ellipseToPoints(
              aX,
              aY,
              xRadius,
              yRadius,
              aStartAngle,
              aEndAngle,
              antiClockwise,
              divisions
            )
          )

          break
        }
      }
    }

    // if (!this.closed) points.push(points[0])

    this.pointsCache[divisions] = points
    return points
  }

  public toPolygon(scale: number, divisions?: number) {
    const polygon = new Path()
    for (const pt of this.getPoints(divisions)) {
      polygon.push(new Point(pt.x * scale, pt.y * scale))
    }
    return polygon
  }

  // public fromPoly(poly: {X: number; Y: number}, scale: number) {
  //   scale = 1/scale
  // }

  public fromPolygon(polygon: Path, scale: number) {
    scale = 1 / scale

    this.moveTo(polygon[0].x * scale, polygon[0].y * scale)

    for (let i = 1, l = polygon.length; i < l; ++i) {
      this.lineTo(polygon[i].x * scale, polygon[i].y * scale)
    }

    this.close()
    // todo: close properly (closePath())
    // this.lineTo(poly[0].X*scale, poly[0].Y*scale);
    return this
  }

  public close() {
    if (this.isClosed()) return

    const curStart = this.actions[0].args
    this.lineTo(curStart[0], curStart[1])
  }

  public reverse() {
    const result = new SubPath()
    const pts = this.getPoints().reverse()
    if (pts.length == 0) return result
    result.moveTo(pts[0].x, pts[0].y)
    for (let i = 1, l = pts.length; i < l; ++i) result.lineTo(pts[i].x, pts[i].y)
    return result
  }
}

// Bezier Curves formulas obtained from
// http://en.wikipedia.org/wiki/B%C3%A9zier_curve

// Quad Bezier Functions
const b2p0 = (t: number, p: number) => {
  const k = 1 - t
  return k * k * p
}
const b2p1 = (t: number, p: number) => 2 * (1 - t) * t * p
const b2p2 = (t: number, p: number) => t * t * p
const b2 = (t: number, p0: number, p1: number, p2: number) =>
  b2p0(t, p0) + b2p1(t, p1) + b2p2(t, p2)

// Cubic Bezier Functions
const b3p0 = (t: number, p: number) => {
  const k = 1 - t
  return k * k * k * p
}
const b3p1 = (t: number, p: number) => {
  const k = 1 - t
  return 3 * k * k * t * p
}
const b3p2 = (t: number, p: number) => {
  const k = 1 - t
  return 3 * k * t * t * p
}
const b3p3 = (t: number, p: number) => t * t * t * p
const b3 = (t: number, p0: number, p1: number, p2: number, p3: number) =>
  b3p0(t, p0) + b3p1(t, p1) + b3p2(t, p2) + b3p3(t, p3)
