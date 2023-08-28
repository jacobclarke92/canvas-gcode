import Matrix from './Matrix'
import Point from './Point'
import Path, { Bounds, WindingRule } from './Path'
import SubPath, { ArcAction, BezierCurveToAction, QuadraticCurveToAction } from './SubPath'
import { arcToPoints, convertPointsToEdges, pointsToArc } from './utils/pathUtils'
import Motion from './Motion'
import Driver, { Unit } from './drivers/Driver'
import GCodeDriver from './drivers/GCodeDriver'
import NullDriver from './drivers/NullDriver'
import { OverloadedFunctionWithOptionals } from './types'

export interface GCanvasConfig {
  width: number
  height: number
  virtualScale?: number
  background?: string
  canvas?: HTMLCanvasElement
  output?: HTMLTextAreaElement
  driver?: Driver
}

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

export type StrokeOptions = {
  align?: StrokeAlign
  depth?: number
  cutout?: boolean
  debug?: boolean
}

export default class GCanvas {
  public canvasWidth: number
  public canvasHeight: number
  public virtualScale: number
  public outputElement?: HTMLTextAreaElement
  public canvasElement?: HTMLCanvasElement
  public ctx?: CanvasRenderingContext2D
  public motion: Motion
  public driver: GCodeDriver

  public canvas: { width: number; height: number }

  public enableCutouts: boolean = true

  // cnc-specific stuff
  public precision: number = 20
  public align: StrokeAlign = 'center'
  public ramping: boolean = true
  public depth: number = 0
  public depthOfCut: number = 0
  public retract = 0
  public speed = 500
  public feed = 1000
  public act = 0
  public unit: Unit = 'mm'
  public top: number = 0
  public toolDiameter: number = 0.15

  private matrix: Matrix = new Matrix()
  private clipRegion?: Path
  public path?: Path
  private subPaths: SubPath[] = []
  private filters: any[] = [] // no idea hey
  private stack: CanvasStackItem[] = []

  private pathHistory: any[] = []

  // vars that get relayed to canvas
  private _strokeStyle: string = '#000000'
  private _fillStyle: string = '#000000'
  private _font: string = '7pt Helvetica'
  private _background: string = '#ffffff'

  constructor(config: GCanvasConfig) {
    this.driver = config.driver || new NullDriver()
    this.motion = new Motion(this)
    this.canvasWidth = config.width
    this.canvasHeight = config.height
    this.virtualScale = config.virtualScale || 1
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
      this.ctx.resetTransform()
      this.setCtxTransform(this.matrix)

      // draw rect the actual size of the canvas - should fill whole screen at this stage
      this.ctx.fillStyle = this._background
      this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)

      this.ctx.lineWidth = 1 / this.virtualScale
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

  private setCtxTransform(matrix: Matrix) {
    // console.log('before', this.ctx.getTransform())
    this.ctx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty)
    // scale drawable area to match device pixel ratio
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    // scale drawable area to match virtual zoom
    this.ctx.scale(this.virtualScale, this.virtualScale)
    // console.log('after', this.ctx.getTransform())
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
  }
  public restore() {
    if (!this.stack.length) {
      console.warn('Cannot restore: GCanvas stack empty!')
      return
    }
    const prev = this.stack.pop()
    ;(Object.keys(prev) as CanvasStackItemKey[]).forEach((key) => {
      //@ts-ignore
      this[key] = prev[key]
    })
    this.setCtxTransform(prev.matrix)
    this.ctx.lineWidth = 1 / this.virtualScale
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
    this.ctx?.rotate((theta / 180) * Math.PI)
  }

  public translate(x: number, y: number) {
    this.matrix = this.matrix.translate(x, y)
    // this.ctx?.scale(1 / this.virtualScale, 1 / this.virtualScale)
    // this.ctx?.scale(1 / window.devicePixelRatio, 1 / window.devicePixelRatio)
    this.ctx.resetTransform()
    this.ctx?.translate(x, y)
    this.ctx?.scale(this.virtualScale, this.virtualScale)
    this.ctx?.scale(window.devicePixelRatio, window.devicePixelRatio)
  }

  public scale(x: number, y?: number) {
    this.matrix = this.matrix.scale(x, y)
    this.ctx?.scale(x, y || x)
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

    const center = new Point(x, y)
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

  public rect: OverloadedFunctionWithOptionals<
    [pt: Point, w: number, h: number] | [x: number, y: number, w: number, h: number],
    [cutout: true]
  > = (...args) => {
    const cutout = (args.length === 4 && args[3] === true) || args.length === 5 || false
    const x = args.length === 3 || (args.length === 4 && args[3] === true) ? args[0].x : args[0]
    const y = args.length === 3 || (args.length === 4 && args[3] === true) ? args[0].y : args[1]
    const w = args.length === 3 || (args.length === 4 && args[3] === true) ? args[1] : args[2]
    const h = args.length === 3 || (args.length === 4 && args[3] === true) ? args[2] : args[3]
    if (cutout) this.cutoutRect(x, y, w, h)
    this.moveTo(x, y)
    this.lineTo(x + w, y)
    this.lineTo(x + w, y + h)
    this.lineTo(x, y + h)
    this.lineTo(x, y)
  }

  public strokeRect: OverloadedFunctionWithOptionals<
    [pt: Point, w: number, h: number] | [x: number, y: number, w: number, h: number],
    [options: StrokeOptions]
  > = (...args) => {
    const x =
      args.length === 3 || (args.length === 4 && typeof args[3] !== 'number')
        ? (args[0] as Point).x
        : (args[0] as number)
    const y =
      args.length === 3 || (args.length === 4 && typeof args[3] !== 'number')
        ? (args[0] as Point).y
        : (args[1] as number)
    const w = args.length === 3 || (args.length === 4 && typeof args[3] !== 'number') ? args[1] : args[2]
    const h = args.length === 3 || (args.length === 4 && typeof args[3] !== 'number') ? args[2] : (args[3] as number)
    const options = args.length === 5 ? args[4] : args.length === 4 && typeof args[3] !== 'number' ? args[3] : undefined
    this.beginPath()
    this.rect(x, y, w, h)
    this.stroke(options)
    this.closePath()
  }

  public fillRect(...args: [pt: Point, w: number, h: number] | [x: number, y: number, w: number, h: number]) {
    const x = args.length === 3 ? args[0].x : args[0]
    const y = args.length === 3 ? args[0].y : args[1]
    const w = args.length === 3 ? args[1] : args[2]
    const h = args.length === 3 ? args[2] : args[3]
    this.beginPath()
    this.rect(x, y, w, h)
    this.fill()
    this.closePath()
  }

  public cutoutRect(x: number, y: number, w: number, h: number) {
    // console.log(this.path.subPaths)
  }

  public circle: OverloadedFunctionWithOptionals<
    [pt: Point, radius: number] | [x: number, y: number, radius: number],
    [ccw: true]
  > = (...args) => {
    const x = args.length === 2 || (args.length === 3 && args[2] === true) ? args[0].x : args[0]
    const y = args.length === 2 || (args.length === 3 && args[2] === true) ? args[0].y : args[1]
    const radius = args.length === 2 || (args.length === 3 && args[2] === true) ? args[1] : args[2]
    const ccw = (args.length === 3 && args[2] === true) || args.length === 4 || false
    this.arc(x, y, radius, 0, Math.PI * 2, ccw)
    // NOTE: not native so do not need to call canvas api
  }

  public strokeCircle(...args: [pt: Point, radius: number] | [x: number, y: number, radius: number]): void {
    const x = args.length === 2 ? args[0].x : args[0]
    const y = args.length === 2 ? args[0].y : args[1]
    const radius = args.length === 2 ? args[1] : args[2]
    this.beginPath()
    this.circle(x, y, radius)
    this.stroke()
    this.closePath()
  }

  public fillCircle(...args: [pt: Point, radius: number] | [x: number, y: number, radius: number]) {
    const x = args.length === 2 ? args[0].x : args[0]
    const y = args.length === 2 ? args[0].y : args[1]
    const radius = args.length === 2 ? args[1] : args[2]
    this.beginPath()
    this.circle(x, y, radius)
    this.fill()
    this.closePath()
  }

  public strokeLine(...args: [Point, Point] | [x1: number, y1: number, x2: number, y2: number]) {
    const x1 = args.length === 2 ? args[0].x : args[0]
    const y1 = args.length === 2 ? args[0].y : args[1]
    const x2 = args.length === 2 ? args[1].x : args[2]
    const y2 = args.length === 2 ? args[1].y : args[3]
    this.beginPath()
    this.moveTo(x1, y1)
    this.lineTo(x2, y2)
    this.stroke()
    this.closePath()
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

  public stroke({ align = this.align, depth = this.depth, cutout, debug }: StrokeOptions = {}) {
    if (!this.isOpaque(this.strokeStyle)) return

    const origStrokeStyle = this.ctx.strokeStyle
    if (debug) {
      this.ctx.strokeStyle = 'rgba(255,0,0,0.5)'
    } else {
      let path = this.path

      if (cutout) {
        if (this.pathHistory.length > 0) {
          const currentLines = convertPointsToEdges(path.getPoints())
          console.log('lines making up current shape:', currentLines)
          console.log('previously stored shapes: ', this.pathHistory.length)
          for (let i = this.pathHistory.length - 1; i >= 0; i--) {
            const compareLines = convertPointsToEdges(this.pathHistory[i].getPoints())
            console.log(`history item ${i} lines:`, compareLines)
          }
        }
      }

      this.save()

      let offset = 0
      if (align === 'outer') offset = this.toolDiameter / 2
      if (align === 'inner') offset = -this.toolDiameter / 2

      if (align !== 'center') {
        path = path.simplify('evenodd', this.precision)
        path = path.offset(offset) || path
      }

      if (path.subPaths) {
        path.subPaths.forEach((subPath) => {
          // Climb milling
          if (align == 'inner') subPath = subPath.reverse()
          this.layer(subPath, (z) => {
            this.motion.followPath(subPath, z)
          })
        })
      } else {
        console.warn('stroke has no subpaths?')
      }
      // this.motion.retract()

      this.restore()
    }

    this.ctx?.stroke()

    if (debug) this.ctx.strokeStyle = origStrokeStyle
  }

  public fill(windingRule?: WindingRule) {
    if (!this.isOpaque(this.fillStyle)) return

    this.save()

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

    // this.motion.retract()

    this.restore()

    this.ctx?.fill()
  }

  public clearRect(x: number, y: number, width: number, height: number) {
    this.ctx?.clearRect(x, y, width, height)
  }

  public closePath() {
    this.path.close()
    if (this.enableCutouts) this.pathHistory.push(this.path.current.clone())
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
