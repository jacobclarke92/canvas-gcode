import type {
  AllCommandParams,
  ArcParams,
  BezierCurveParams,
  EllipseParams,
  LinearParams,
  RapidParams,
  Unit,
  ZeroParams,
} from './drivers/Driver'
import type GCanvas from './GCanvas'
import type Path from './Path'
import Point from './Point'
import type {
  BezierCurveToAction,
  EllipseAction,
  LineToAction,
  MoveToAction,
  QuadraticCurveToAction,
} from './SubPath'
import SubPath, { DEFAULT_DIVISIONS } from './SubPath'
import { arcToPoints, pointsToArc, sameFloat, samePos } from './utils/pathUtils'

export default class Motion {
  public currentUnit: Unit
  public currentToolDiameter: number
  public currentSpeed: number
  public currentFeed: number
  public currentAtc: number
  public position: Point = new Point()
  public ctx: GCanvas
  private penState: 'up' | 'down' | 'unknown' = 'unknown'

  constructor(ctx: GCanvas) {
    this.ctx = ctx
  }

  public reset() {
    this.currentUnit = undefined
    this.currentToolDiameter = undefined
    this.currentSpeed = undefined
    this.currentFeed = undefined
    this.currentAtc = undefined
    this.position = new Point()
  }

  public retract(timeMs = 250) {
    if (this.penState === 'up') return
    this.ctx.driver.send('M05 (pen up)')
    this.ctx.driver.wait(timeMs)
    this.penState = 'up'
  }
  public plunge(timeMs = 500) {
    if (this.penState === 'down') return
    this.ctx.driver.send('M03 (pen down)')
    this.ctx.driver.wait(timeMs)
    this.penState = 'down'
  }
  public zero(params: ZeroParams) {
    this.ctx.driver.zero(params)
  }

  public rapid(params: RapidParams) {
    const newPosition = this.postProcess(params)
    if (!newPosition) return
    this.ctx.driver.rapid(params)
    this.position = newPosition
  }

  public linear(params: LinearParams) {
    const newPosition = this.postProcess(params)
    if (!newPosition) return

    // if(params.z - this.position.z > 10)
    //   debugger;

    this.ctx.driver.linear(params)
    this.position = newPosition
  }
  public arcCW(params: ArcParams) {
    return this.arc(params, false)
  }
  public arcCCW(params: ArcParams) {
    return this.arc(params, true)
  }
  public arc(params: ArcParams, ccw = false) {
    const newPosition = this.postProcess({ ...params, z: this.position.z || 0 })
    // Note: Can be cyclic so we don't ignore it if the position is the same
    const cx = this.position.x + (params.i || 0)
    const cy = this.position.y + (params.j || 0)
    const arc = pointsToArc(new Point(cx, cy), this.position, new Point(params.x, params.y))

    const length = arc.radius * (arc.end - arc.start)
    let f = length / (1 / this.ctx.feed)
    f = Math.round(f * 1000000) / 1000000
    if (f) params.f = Math.abs(f)

    if (!ccw && this.ctx.driver.arcCW) {
      this.ctx.driver.arcCW(params, 'arc clockwise')
    } else if (ccw && this.ctx.driver.arcCCW) {
      this.ctx.driver.arcCCW(params, 'arc counter-clockwise')
    } else {
      this.interpolate('arc', [cx, cy, arc.radius, arc.start, arc.end, ccw], params.z || 0)
    }

    if (newPosition) this.position = newPosition
  }

  /**
   * I<pos> Offset from the X start point to first control point
   * J<pos> Offset from the Y start point to first control point
   * P<pos> Offset from the X end point to second control point
   * Q<pos> Offset from the Y end point to the second control point
   * X<pos> A destination coordinate on the X axis
   * Y<pos> A destination coordinate on the Y axis
   **/
  /*
  public bezierCurve(params: BezierCurveParams) {
    this.ctx.driver.bezierCurve(params)
    const newPosition = this.postProcess({ ...params, z: this.position.z || 0 })
    if (newPosition) this.position = newPosition
  }
  */

  public postProcess(params: Partial<AllCommandParams>) {
    // Sync meta
    // if (this.ctx.driver.unit && this.ctx.unit != this.currentUnit) {
    //   this.ctx.driver.unit(this.ctx.unit)
    //   this.currentUnit = this.ctx.unit
    // }

    // Sync meta
    if (this.ctx.driver.meta && this.ctx.toolDiameter != this.currentToolDiameter) {
      this.ctx.driver.meta({
        toolDiameter: this.ctx.toolDiameter,
      })
      this.currentToolDiameter = this.ctx.toolDiameter
    }

    // Set new spindle atc changed
    // if (this.ctx.driver.atc && this.ctx.atc != this.currentAtc) {
    //   this.ctx.driver.atc(this.ctx.atc)
    //   this.currentAtc = this.ctx.atc
    // }

    // Set new spindle speed changed
    if (this.ctx.driver.speed && this.ctx.speed != this.currentSpeed) {
      // we ignore speed command because is messes up the vigo drawer software
      // this.ctx.driver.speed(this.ctx.speed)
      this.currentSpeed = this.ctx.speed
    }

    // Set new feedrate changed
    if (this.ctx.driver.feed && this.ctx.feed != this.currentFeed) {
      // Always use inverse time mode
      // but we only send a G93 when there is a feedrate.
      // This allows backwards compatibility with global
      // classic feedrates.
      this.ctx.driver.send('G93 (inverse time mode)')
      this.currentFeed = this.ctx.feed
    }

    // Set coolant if changed
    // if (this.ctx.driver.coolant && this.ctx.coolant != this.currentCoolant) {
    //   this.ctx.driver.coolant(this.ctx.coolant)
    //   this.currentCoolant = this.ctx.coolant
    // }

    const v1 = new Point(
      'x' in params ? params.x : this.position.x,
      'y' in params ? params.y : this.position.y,
      'z' in params ? params.z : this.position.z,
      'a' in params ? params.a : this.position.a
    )

    const v2 = this.position
    const dist = Math.sqrt(
      Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2) /* + Math.pow(v2.z - v1.z, 2)*/
    )

    if (!params.f) {
      let f = dist / (1 / this.ctx.feed)
      f = Math.max(f, this.ctx.minFeed)
      f = Math.round(f * 1000000) / 1000000
      if (f) params.f = Math.abs(f)
    }

    if (samePos(this.position, v1)) return false

    // this.ctx.filters.forEach(function (f) {
    //   const tmp = f.call(this.ctx, params)
    //   if (tmp) {
    //     for (let k in tmp) {
    //       params[k] = tmp[k]
    //     }
    //   }
    // })

    // Round down the decimal points to 10 nanometers
    // Gotta accept that there's no we're that precise.
    for (const k in params) {
      const key = k as keyof AllCommandParams
      if (typeof params[key] === 'number') {
        params[key] = Math.round(params[key] * 100000) / 100000
      }
    }

    return v1
  }

  public interpolate(name: keyof SubPath, args: any[], zEnd: number) {
    const path = new SubPath()
    const func = path[name]
    if (typeof func === 'function') func.apply(path, args)

    let curLen = 0
    const totalLen = path.getLength()
    const zStart = this.position.z
    const fullDelta = zEnd - zStart

    const pts = path.getPoints(40)
    for (let i = 0, l = pts.length; i < l; ++i) {
      const p = pts[i]

      const xo = p.x - this.position.x
      const yo = p.y - this.position.y
      curLen += Math.sqrt(xo * xo + yo * yo)

      this.linear({
        x: p.x,
        y: p.y,
        z: zStart + (curLen / totalLen) * fullDelta,
      })
    }
  }

  public followPath(path: Path | SubPath, zEnd: number) {
    if (!path) return false

    if ('subPaths' in path) {
      path.subPaths.forEach((subPath) => {
        this.followPath(subPath, zEnd)
      })
      return
    }

    let zStart = this.position.z
    const totalLen = path.getLength()
    let curLen = 0

    const ctx = this.ctx
    const ramping = path.isClosed() && ctx.ramping != false

    // console.log('tracing motion subpath', path)

    function helix() {
      if (!ramping) return zEnd

      // Avoid divide by 0 in case of a single moveTo action
      if (totalLen === 0) return 0

      const fullDelta = zEnd - zStart
      const ratio = curLen / totalLen
      const curDelta = fullDelta * ratio

      return zStart + curDelta
    }

    function interpolate(motion: Motion, name: keyof SubPath, args: any[]) {
      const path = new SubPath()
      path.moveTo(motion.position.x, motion.position.y)
      const func = path[name]
      if (typeof func === 'function') func.apply(path, args)

      const pts = path.getPoints(40)
      for (let i = 0, l = pts.length; i < l; ++i) {
        const p = pts[i]
        motion.linear({ x: p.x, y: p.y, z: helix() })
      }
    }

    const each = {
      ['MOVE_TO' as MoveToAction['type']]: (...args: MoveToAction['args']) => {
        // console.log('[motion] move to', args)
        const [x, y] = args
        // Optimize out 0 distances moves
        const sameXY = sameFloat(x, this.position.x) && sameFloat(y, this.position.y)
        if (ramping && sameXY) return

        if (!sameXY) this.retract()
        this.rapid({ x, y })
        if (!sameXY) this.plunge()

        if (!ramping) this.linear({ z: zEnd })
        zStart = this.position.z
      },
      ['LINE_TO' as LineToAction['type']]: (...args: LineToAction['args']) => {
        // console.log('[motion] line to', args)
        const [x, y] = args
        this.linear({ x, y, z: helix() })
      },
      ['ELLIPSE' as EllipseAction['type']]: (...args: EllipseAction['args']) => {
        // console.log('[motion] ellipse', args)
        const [x, y, rx, ry, aStart, aEnd, ccw] = args
        // Detect plain arc
        if (!path.hasBeenCutInto && sameFloat(rx, ry)) {
          const points = arcToPoints(x, y, aStart, aEnd, rx, ry)
          const params: EllipseParams = {
            x: points.end.x,
            y: points.end.y,
            i: x - points.start.x,
            j: y - points.start.y,
            z: helix(),
          }
          this.arc(params, ccw)
        } else {
          interpolate(this, 'ellipse', args)
        }
      },
      ['BEZIER_CURVE_TO' as BezierCurveToAction['type']]: (
        ...args: BezierCurveToAction['args']
      ) => {
        // console.log('[motion] bezierCurveTo', args)
        /*if (this.ctx.driver.bezierCurve) {
          // args: [aCP1x: number, aCP1y: number, aCP2x: number, aCP2y: number, aX: number, aY: number]
          this.bezierCurve({
            i: args[0] - this.position.x,
            j: args[1] - this.position.y,
            p: args[2] - this.position.x,
            q: args[3] - this.position.y,
            x: args[4],
            y: args[5],
          })
        } else */
        interpolate(this, 'bezierCurveTo', args)
      },
      ['QUADRATIC_CURVE_TO' as QuadraticCurveToAction['type']]: (
        ...args: QuadraticCurveToAction['args']
      ) => {
        // console.log('[motion] quadraticCurveTo', args)
        interpolate(this, 'quadraticCurveTo', args)
      },
    }

    if (path.hasBeenCutInto && path.pointsCache[DEFAULT_DIVISIONS]) {
      console.log('[motion] path has been cut into (using point cache for path)')
      const points = path.pointsCache[DEFAULT_DIVISIONS]
      for (let p = 0; p < points.length; p++) {
        const pt = points[p]
        if (p == 0) {
          each['MOVE_TO'].apply(this, [pt.x, pt.y] as MoveToAction['args'])
        } else {
          each['LINE_TO'].apply(this, [pt.x, pt.y] as LineToAction['args'])
        }
        // if (p == points.length - 1) {
        //   const dist = pt.distanceTo(points[0])
        //   if (dist < 2) {
        //     console.log('[motion] path is done, adding final line to start, based on dist:', dist)
        //     each['LINE_TO'].apply(this, [points[0].x, points[0].y] as LineToAction['args'])
        //   }
        // }
      }
    } else {
      // console.log('[motion] path has not been tampered with so generating fresh points')
      for (let i = 0, l = path.actions.length; i < l; ++i) {
        const action = path.actions[i]

        if (i != 0) {
          const x0 = this.position.x
          const y0 = this.position.y
          curLen += path.getActionLength(x0, y0, i)
        }

        each[action.type].apply(this, action.args)
      }
    }
  }
}
