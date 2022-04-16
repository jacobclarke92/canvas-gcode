import Matrix from './Matrix'
import Point from './Point'
import Path, { Bounds, WindingRule } from './Path'
import SubPath, { ArcAction, BezierCurveToAction, QuadraticCurveToAction } from './SubPath'
import { arcToPoints, pointsToArc } from './utils/pathUtils'
import Motion from './Motion'
import GCode from './GCode'

export interface GCanvasConfig {
  width: number
  height: number
  background?: string
  canvas?: HTMLCanvasElement
  output?: HTMLTextAreaElement
  driver?: GCode
}

export type Unit = 'mm' | 'inch'
export type StrokeAlign = 'outer' | 'inner' | 'center'

export type CanvasStackItem = {
  matrix: Matrix
  font: string
  fillStyle: string
  strokeStyle: string
  top: number
  depth: number
  depthOfCut: number
  toolDiameter: number
  align: StrokeAlign
  filters: any[]
}
type CanvasStackItemKey = keyof CanvasStackItem

export default class GCanvas {
  public canvasWidth: number
  public canvasHeight: number
  public outputElement?: HTMLTextAreaElement
  public canvasElement?: HTMLCanvasElement
  public ctx?: CanvasRenderingContext2D
  public motion: Motion
  public driver: GCode

  public canvas: { width: number; height: number }

  // cnc-specific stuff
  public precision: number = 20
  public align: StrokeAlign = 'center'
  public ramping: boolean = true
  public depth: number = 0
  public depthOfCut: number = 0
  public retract = 0
  public speed = 10
  public feed = 10
  public act = 0
  public unit: Unit = 'mm'
  public top: number = 0
  public toolDiameter: number = 0.25

  private matrix: Matrix = new Matrix()
  private clipRegion?: Path
  private path?: Path
  private subPaths: SubPath[] = []
  private filters: any[] = [] // no idea hey
  private stack: CanvasStackItem[] = []

  // vars that get relayed to canvas
  private _strokeStyle: string = '#000000'
  private _fillStyle: string = '#000000'
  private _font: string = '7pt Helvetica'
  private _background: string = '#ffffff'

  constructor(config: GCanvasConfig) {
    this.driver = config.driver || new GCode()
    this.motion = new Motion(this)
    this.canvasWidth = config.width
    this.canvasHeight = config.height
    if (config.canvas) {
      this.canvasElement = config.canvas
      this.ctx = this.canvasElement.getContext('2d')
    }
    if (config.output) this.outputElement = config.output
    if (config.background) this._background = config.background

    this.reset()
  }

  public reset() {
    console.clear()
    this.driver.reset()
    this.motion.reset()
    this.path = undefined
    this.clipRegion = undefined
    this.subPaths = []
    this.filters = []
    this.stack = []
    this.matrix = new Matrix()
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
      this.ctx.resetTransform()
      // scale drawable area to match device pixel ratio
      this.ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0)
      this.ctx.fillStyle = this._background
      this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
      this.ctx.strokeStyle = '#000000'
    }
  }

  public get strokeStyle() {
    return this._strokeStyle
  }
  public set strokeStyle(value: string) {
    this._strokeStyle = value
    if (this.ctx) this.ctx.strokeStyle = value
  }

  public get fillStyle() {
    return this._fillStyle
  }
  public set fillStyle(value: string) {
    this._fillStyle = value
    if (this.ctx) this.ctx.fillStyle = value
  }

  public get font() {
    return this._fillStyle
  }
  public set font(value: string) {
    this._font = value
    if (this.ctx) this.ctx.font = value
  }

  public save() {
    this.stack.push({
      matrix: this.matrix,
      font: this.font,
      depth: this.depth,
      depthOfCut: this.depthOfCut,
      toolDiameter: this.toolDiameter,
      align: this.align,
      top: this.top,
      strokeStyle: this.strokeStyle,
      fillStyle: this.fillStyle,
      filters: this.filters.slice(),
    })
    this.ctx?.save()
  }
  public restore() {
    const prev = this.stack.pop()
    ;(Object.keys(prev) as CanvasStackItemKey[]).forEach((key) => {
      //@ts-ignore
      this[key] = prev[key]
    })
    this.ctx?.restore()
  }

  public beginPath() {
    this.path = new Path()
    this.ctx?.beginPath()
  }

  public transform(a?: number, b?: number, c?: number, d?: number, e?: number, f?: number) {
    this.matrix = this.matrix.concat(new Matrix(a, b, c, d, e, f))
    this.ctx?.transform(a, b, c, d, e, f)
  }

  public setTransform(a?: number, b?: number, c?: number, d?: number, e?: number, f?: number) {
    this.matrix = new Matrix(a, b, c, d, e, f)
    this.ctx?.setTransform(a, b, c, d, e, f)
  }

  public resetTransform() {
    this.matrix = new Matrix()
    this.ctx?.resetTransform()
  }

  public rotate(theta: number) {
    this.matrix = this.matrix.rotate(theta)
    this.ctx?.rotate(theta)
  }

  public translate(x: number, y: number) {
    this.matrix = this.matrix.scale(x, y)
    this.ctx?.translate(x, y)
  }

  public scale(x: number, y?: number) {
    this.matrix = this.matrix.scale(x, y)
    this.ctx?.scale(x, y)
  }

  // Note: this was marked as to-tidy by OG author
  private transformPoint(a: [x: number, y: number] | Point): Point {
    // i = i || 0
    if (a instanceof Array) {
      const v = this.matrix.transformPoint(new Point(a[0], a[1]))
      //   var v = new Point(a[i], a[i + 1])
      //   v = this.matrix.transformPoint(v)
      //   a[i] = v.x
      //   a[i + 1] = v.y
      return new Point(v.x, v.y)
    } else if (a.x !== undefined) {
      var v = new Point(a.x, a.y)
      v = this.matrix.transformPoint(v)
      a.x = v.x
      a.y = v.y
      return v
    }
  }
  private ensurePath(x: number, y: number) {
    if (!this.path) return
    if (this.path.subPaths.length === 0) {
      this.path.moveTo(x, y)
    }
  }

  public moveTo(_x: number, _y: number) {
    const { x, y } = this.transformPoint([_x, _y])
    this.path.moveTo(x, y)
    this.ctx?.moveTo(x, y)
  }

  public lineTo(_x: number, _y: number) {
    const { x, y } = this.transformPoint([_x, _y])
    this.ensurePath(x, y)
    this.path.lineTo(x, y)
    this.ctx?.lineTo(x, y)
  }

  public arcTo(_x1: number, _y1: number, _x2: number, _y2: number, radius: number) {
    // TODO: this doesn't mutate the arguments array yet
    const { x: x1, y: y1 } = this.transformPoint([_x1, _y1])
    const { x: x2, y: y2 } = this.transformPoint([_x2, _y2])

    this.ensurePath(x1, y1)

    const p0 = this.path.lastPoint() || new Point()
    const p1 = new Point(x1, y1)
    const p2 = new Point(x2, y2)
    const v01 = p0.subtract(p1)
    const v21 = p2.subtract(p1)

    // sin(A - B) = sin(A) * cos(B) - sin(B) * cos(A)
    const cross = v01.x * v21.y - v01.y * v21.x

    if (Math.abs(cross) < 1e-10) {
      // on one line
      this.lineTo(x1, y1)
      return
    }

    const d01 = v01.magnitude()
    const d21 = v21.magnitude()
    const angle = (Math.PI - Math.abs(Math.asin(cross / (d01 * d21)))) / 2
    const span = radius * Math.tan(angle)
    let rate = span / d01

    const startPoint = new Point(p1.x + v01.x * rate, p1.y + v01.y * rate)

    rate = span / d21

    const endPoint = new Point(p1.x + v21.x * rate, p1.y + v21.y * rate)

    const midPoint = new Point((startPoint.x + endPoint.x) / 2, (startPoint.y + endPoint.y) / 2)

    const vm1 = midPoint.subtract(p1)
    const dm1 = vm1.magnitude()
    const d = Math.sqrt(radius * radius + span * span)

    const centerPoint = new Point()
    rate = d / dm1
    centerPoint.x = p1.x + vm1.x * rate
    centerPoint.y = p1.y + vm1.y * rate

    const arc = pointsToArc(centerPoint, startPoint, endPoint)

    this.path.lineTo(startPoint.x, startPoint.y)
    this.path.arc(centerPoint.x, centerPoint.y, arc.radius, arc.start, arc.end, cross > 0)

    this.ctx?.arcTo(x1, y1, x2, y2, radius)
  }

  public arc(...args: ArcAction['args']) {
    let [x, y, radius, aStartAngle, aEndAngle, antiClockwise] = args

    // In the conversion to points we lose the distinction
    // between 0 and pi2 so we must optimize out 0 here
    // or else they will be treated as full circles.

    if (aStartAngle - aEndAngle === 0) return

    // See portal2 example
    if (aEndAngle - aStartAngle === -Math.PI * 2) aEndAngle = Math.PI * 2

    var center = new Point(x, y)
    var points = arcToPoints(x, y, aStartAngle, aEndAngle, radius)

    this.transformPoint(center)
    this.transformPoint(points.start)
    this.transformPoint(points.end)

    const res = pointsToArc(center, points.start, points.end)

    // this.ensurePath(points.start.x, points.start.y)

    if (!this.path) throw 'beginPath not called yet'
    this.path.arc(center.x, center.y, res.radius, res.start, res.end, antiClockwise)

    // var tmp = new Path();
    // tmp.moveTo(points.start.x, points.start.y);
    // tmp.arc(center.x, center.y, radius, res.start, res.end, aClockwise);

    // tmp.getPoints(40).forEach(function(p) {
    //   this.lineTo(p.x,p.y);
    // },this);

    this.ctx?.arc(x, y, radius, aStartAngle, aEndAngle, antiClockwise)
  }
  public circle(x: number, y: number, rad: number, ccw: boolean = false) {
    this.arc(x, y, rad, 0, Math.PI * 2, ccw)
    // NOTE: not native so do not need to call canvas api
  }
  public bezierCurveTo(...args: BezierCurveToAction['args']) {
    // let [aCP1x, aCP1y, aCP2x, aCP2y, aX, aY] = args
    const { x: aCP1x, y: aCP1y } = this.transformPoint([args[0], args[1]])
    const { x: aCP2x, y: aCP2y } = this.transformPoint([args[2], args[3]])
    const { x: aX, y: aY } = this.transformPoint([args[4], args[5]])
    this.path.bezierCurveTo(aCP1x, aCP1y, aCP2x, aCP2y, aX, aY)

    this.ctx?.bezierCurveTo(aCP1x, aCP1y, aCP2x, aCP2y, aX, aY)
  }
  public quadraticCurveTo(...args: QuadraticCurveToAction['args']) {
    // const [aCPx, aCPy, aX, aY] = args
    const { x: aCPx, y: aCPy } = this.transformPoint([args[0], args[1]])
    const { x: aX, y: aY } = this.transformPoint([args[2], args[3]])
    this.path.quadraticCurveTo(aCPx, aCPy, aX, aY)

    this.ctx?.quadraticCurveTo(aCPx, aCPy, aX, aY)
  }
  public clip() {
    this.clipRegion = this.path
    this.ctx?.clip()
  }
  public rect(x: number, y: number, w: number, h: number) {
    this.moveTo(x, y)
    this.lineTo(x + w, y)
    this.lineTo(x + w, y + h)
    this.lineTo(x, y + h)
    this.closePath()
    this.ctx?.rect(x, y, w, h)
  }
  public fillRect(x: number, y: number, w: number, h: number, depth?: number) {
    this.save()
    this.beginPath()
    this.depth = depth || this.depth
    this.rect(x, y, w, h)
    this.fill()
    this.restore()
    this.ctx?.fillRect(x, y, w, h)
  }
  public fillCircle(x: number, y: number, rad: number, depth?: number) {
    this.save()
    this.beginPath()
    this.depth = depth || this.depth
    this.circle(x, y, rad)
    this.fill()
    this.restore()
    // NOTE: not native so do not need to call canvas api
  }
  public clone() {}
  public measureText(text: string): Bounds {
    return {
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    }
  }

  private isOpaque(color: string): boolean {
    if (color == 'transparent') return false
    if (color == 'none') return false

    if (typeof color == 'string' && color.match(/rgba\((?:.*,){3}[0\.]*\)/)) {
      return false
    }

    return true
  }
  public stroke(align: StrokeAlign = this.align, depth: number = this.depth) {
    if (!this.isOpaque(this.strokeStyle)) return
    this.save()

    let offset = 0

    if (align === 'outer') {
      offset = this.toolDiameter / 2
    }
    if (align === 'inner') {
      offset = -this.toolDiameter / 2
    }

    var path = this.path

    if (align != 'center') {
      path = path.simplify('evenodd', this.precision)
      path = path.offset(offset) || path
    }

    if (path.subPaths)
      path.subPaths.forEach((subPath) => {
        // Climb milling
        if (align == 'inner') subPath = subPath.reverse()
        this.layer(subPath, (z) => {
          this.motion.followPath(subPath, z)
        })
      })
    this.motion.retract()

    this.restore()

    this.ctx?.stroke()
  }

  public fill(windingRule?: WindingRule, depth?: number) {
    if (!this.isOpaque(this.fillStyle)) return

    this.save()

    if (depth) this.depth = depth

    if (!this.toolDiameter) throw 'You must set context.toolDiameter to use fill()'

    let path = this.path
    path = path.simplify(windingRule, this.precision)
    path = path.clip(this.clipRegion, 0, this.precision)
    path = path.fillPath(this.toolDiameter, this.precision)

    if (path.subPaths)
      path.subPaths.forEach((subPath) => {
        this.layer(subPath, (z) => {
          this.motion.followPath(subPath, z)
        })
      }, this)

    this.motion.retract()

    this.restore()

    this.ctx?.fill()
  }
  public clearRect(x: number, y: number, width: number, height: number) {
    this.ctx?.clearRect(x, y, width, height)
  }
  public closePath() {
    this.path.close()
    this.ctx?.closePath()
  }

  // public fillText(text: string, x: number, y: number, params: any) {
  //     this.text(text, x, y, params);
  //     this.fill();
  //   }
  // public strokeText(text: string, x: number, y: number, params: any) {
  //     this.text(text, x, y, params);
  //     this.stroke();
  //   }

  private layer(subPath: SubPath, fn: (z: number) => void) {
    let depthOfCut = this.depthOfCut || this.depth

    if (depthOfCut === 0) {
      fn.call(this, -this.top)
      return
    }

    const invertedZ = this.depth < 0
    if (invertedZ && depthOfCut > 0) depthOfCut = -depthOfCut

    let steps = Math.ceil(Math.abs(this.depth / depthOfCut))
    let offset = -this.top
    while (steps--) {
      offset -= depthOfCut

      // Clip to actual depth
      if (invertedZ) {
        offset = Math.max(offset, this.top + this.depth)
      } else {
        offset = Math.max(offset, -this.top - this.depth)
      }

      // Remove the material at this depth
      fn.call(this, offset)
    }

    // Finishing pass
    if (this.ramping && subPath.isClosed()) {
      fn.call(this, offset)
    }
  }
}
