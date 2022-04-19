import GCanvas from './GCanvas'
import {
  AllCommandParams,
  ZeroParams,
  RapidParams,
  LinearParams,
  ArcParams,
  EllipseParams,
  Unit,
} from './drivers/Driver'
import Path from './Path'
import Point from './Point'
import SubPath, {
  BezierCurveToAction,
  EllipseAction,
  LineToAction,
  MoveToAction,
  QuadraticCurveToAction,
} from './SubPath'
import { arcToPoints, pointsToArc, sameFloat, samePos } from './utils/pathUtils'

export default class Motion {
  public currentUnit: Unit
  public currentToolDiameter: number
  public currentSpeed: number
  public currentFeed: number
  public currentAtc: number
  public position: Point = new Point()
  public ctx: GCanvas

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

  public retract() {
    this.rapid({ z: this.ctx.retract })
  }
  public plunge() {
    this.rapid({ z: -this.ctx.top })
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
  public arc(params: ArcParams, ccw: boolean = false) {
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
      this.ctx.driver.arcCW(params)
    } else if (ccw && this.ctx.driver.arcCCW) {
      this.ctx.driver.arcCCW(params)
    } else {
      this.interpolate('arc', [cx, cy, arc.radius, arc.start, arc.end, ccw], params.z || 0)
    }

    if (newPosition) this.position = newPosition
  }

  public postProcess(params: Partial<AllCommandParams>) {
    // Sync meta
    if (this.ctx.driver.unit && this.ctx.unit != this.currentUnit) {
      this.ctx.driver.unit(this.ctx.unit)
      this.currentUnit = this.ctx.unit
    }

    // Sync meta
    if (this.ctx.driver.meta && this.ctx.toolDiameter != this.currentToolDiameter) {
      this.ctx.driver.meta({
        tooldiameter: this.ctx.toolDiameter,
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
      this.ctx.driver.speed(this.ctx.speed)
      this.currentSpeed = this.ctx.speed
    }

    // Set new feedrate changed
    if (this.ctx.driver.feed && this.ctx.feed != this.currentFeed) {
      // Always use inverse time mode
      // but we only send a G93 when there is a feedrate.
      // This allows backwards compatibility with global
      // classic feedrates.
      this.ctx.driver.send('G93')
      this.currentFeed = this.ctx.feed
    }

    // Set coolant if changed
    // if (this.ctx.driver.coolant && this.ctx.coolant != this.currentCoolant) {
    //   this.ctx.driver.coolant(this.ctx.coolant)
    //   this.currentCoolant = this.ctx.coolant
    // }

    const v1 = new Point(
      params.x === undefined ? this.position.x : params.x,
      params.y === undefined ? this.position.y : params.y,
      params.z === undefined ? this.position.z : params.z,
      params.a === undefined ? this.position.a : params.a
    )

    const v2 = this.position
    const dist = Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2) + Math.pow(v2.z - v1.z, 2))

    if (!params.f) {
      let f = dist / (1 / this.ctx.feed)
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
    for (let k in params) {
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

    function helix() {
      const fullDelta = zEnd - zStart
      const ratio = curLen / totalLen
      const curDelta = fullDelta * ratio
      return zStart + curDelta
    }

    const pts = path.getPoints(40)
    for (let i = 0, l = pts.length; i < l; ++i) {
      const p = pts[i]

      const xo = p.x - this.position.x
      const yo = p.y - this.position.y
      curLen += Math.sqrt(xo * xo + yo * yo)

      this.linear({ x: p.x, y: p.y, z: helix() })
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

    const motion = this
    const driver = this.ctx.driver
    const ctx = this.ctx
    const ramping = path.isClosed() && ctx.ramping != false

    function helix() {
      if (!ramping) return zEnd

      // Avoid divide by 0 in case of
      // a single moveTo action
      if (totalLen === 0) return 0

      const fullDelta = zEnd - zStart
      const ratio = curLen / totalLen
      const curDelta = fullDelta * ratio

      return zStart + curDelta
    }

    function interpolate(name: keyof SubPath, args: any[]) {
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
        const [x, y] = args
        // Optimize out 0 distances moves
        const sameXY = sameFloat(x, this.position.x) && sameFloat(y, this.position.y)
        if (ramping && sameXY) return

        motion.retract()
        motion.rapid({ x, y })
        motion.plunge()

        if (!ramping) motion.linear({ z: zEnd })
        zStart = motion.position.z
      },
      ['LINE_TO' as LineToAction['type']]: (...args: LineToAction['args']) => {
        const [x, y] = args
        motion.linear({ x, y, z: helix() })
      },
      ['ELLIPSE' as EllipseAction['type']]: (...args: EllipseAction['args']) => {
        const [x, y, rx, ry, aStart, aEnd, ccw] = args
        // Detect plain arc
        if (sameFloat(rx, ry)) {
          const points = arcToPoints(x, y, aStart, aEnd, rx)
          const params: EllipseParams = {
            x: points.end.x,
            y: points.end.y,
            i: x - points.start.x,
            j: y - points.start.y,
            z: helix(),
          }
          motion.arc(params, ccw)
        } else {
          interpolate('ellipse', args)
        }
      },
      ['BEZIER_CURVE_TO' as BezierCurveToAction['type']]: (...args: BezierCurveToAction['args']) => {
        interpolate('bezierCurveTo', args)
      },
      ['QUADRATIC_CURVE_TO' as QuadraticCurveToAction['type']]: (...args: QuadraticCurveToAction['args']) => {
        interpolate('quadraticCurveTo', args)
      },
    }

    for (let i = 0, l = path.actions.length; i < l; ++i) {
      const action = path.actions[i]

      if (i != 0) {
        const x0 = this.position.x
        const y0 = this.position.y
        curLen += path.getActionLength(x0, y0, i)
      }

      // Every action should be plunged except for move
      // if(item.action !== Path.actions.MOVE_TO) {
      // motion.plunge();
      // }

      each[action.type].apply(this, action.args)
    }
  }
}
