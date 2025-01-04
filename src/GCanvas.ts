import * as clipperLib from 'js-angusj-clipper/web'

import type { Unit } from './drivers/Driver'
import type Driver from './drivers/Driver'
import type GCodeDriver from './drivers/GCodeDriver'
import NullDriver from './drivers/NullDriver'
import Matrix from './Matrix'
import Motion from './Motion'
import { ClipperLib } from './packages/Clipper'
import { Clipper } from './packages/Clipper/Clipper'
import { ClipType } from './packages/Clipper/enums'
import type { IntPoint } from './packages/Clipper/IntPoint'
import type { Bounds, WindingRule } from './Path'
import Path from './Path'
import Point from './Point'
import SubPath from './SubPath'
import {
  type ArcAction,
  type BezierCurveToAction,
  DEFAULT_DIVISIONS,
  type QuadraticCurveToAction,
} from './SubPath'
import type { OverloadedFunctionWithOptionals } from './types'
import type { SimplifiedSvgPathSegment } from './utils/pathToCanvasCommands'
import { pathToCanvasCommands } from './utils/pathToCanvasCommands'
import { arcToPoints, convertPointsToEdges, ellipseToPoints, pointsToArc } from './utils/pathUtils'

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

interface OffsetOptions {
  joinType: clipperLib.JoinType
  endType: clipperLib.EndType
  precision: number
}
const defaultOffsetOptions: OffsetOptions = {
  joinType: clipperLib.JoinType.Miter,
  endType: clipperLib.EndType.ClosedPolygon,
  precision: 1000,
}

export type StrokeOptions = {
  align?: StrokeAlign
  depth?: number
  cutout?: boolean | clipperLib.ClipType
  debug?: boolean
  debugColor?: string
}

export let clipper: clipperLib.ClipperLibWrapper
let inited = false
async function loadClipper() {
  clipper = await clipperLib.loadNativeClipperLibInstanceAsync(
    // let it autodetect which one to use, but also available WasmOnly and AsmJsOnly
    clipperLib.NativeClipperLibRequestedFormat.AsmJsOnly
  )
  inited = true
}
if (!inited) loadClipper()

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

  public enableCutouts = true

  // cnc-specific stuff
  public precision = 20
  public align: StrokeAlign = 'center'
  public ramping = false // this is set to false because Vigo loses position when using G0 commands
  public depth = 0
  public depthOfCut = 0
  public retract = 0
  public speed = 50 // not used i don't think
  public feed = 2000 // is actually used to calculate the F value in Motion.postProcess
  public minFeed = 1000
  public act = 0
  public unit: Unit = 'mm'
  public top = 0
  public toolDiameter = 0.15

  private matrix: Matrix = new Matrix()
  private clipRegion?: Path
  public path?: Path
  private subPaths: SubPath[] = []
  private filters: any[] = [] // no idea hey
  private stack: CanvasStackItem[] = []

  public pathHistory: SubPath[] = []

  // vars that get relayed to canvas
  public _strokeStyle = '#000000'
  public _fillStyle = '#000000'
  public _font = '7pt Helvetica'
  public _background = '#ffffff'

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

  public reset(fadeMode = false) {
    console.clear()
    this.driver.reset()
    this.motion.reset()
    this.path = undefined
    this.clipRegion = undefined
    this.subPaths = []
    this.filters = []
    this.stack = []
    this.matrix = new Matrix()
    this.pathHistory = []

    if (this.ctx) {
      this.ctx.resetTransform()
      this.setCtxTransform(this.matrix)

      // draw rect the actual size of the canvas - should fill whole screen at this stage
      this.ctx.fillStyle = fadeMode ? 'rgba(255,255,255,0.01)' : this._background
      this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
      this.ctx.fillStyle = this._background

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
      // @ts-expect-error - this is fine
      this[key] = prev[key]
    })
    this.setCtxTransform(prev.matrix)
    // this.ctx.lineWidth = 1 / this.virtualScale
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

  private transformPoint(pt: [x: number, y: number] | Point): Point {
    if (Array.isArray(pt)) {
      return this.matrix.transformPoint(pt)
    } else {
      return this.matrix.transformPoint(pt)
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

  public lineToRelative(_x: number, _y: number) {
    const { x, y } = this.transformPoint([_x, _y])
    const lastPoint = this.path.lastPoint()
    if (!lastPoint) return
    this.lineTo(lastPoint.x + x, lastPoint.y + y)
  }

  public lineToRelativeAngle(angle: number, dist: number) {
    const lastPoint = this.path.lastPoint()
    if (!lastPoint) return
    const { x, y } = lastPoint.moveAlongAngle(angle, dist)
    this.lineTo(x, y)
  }

  public arcTo(_x1: number, _y1: number, _x2: number, _y2: number, radius: number) {
    // console.log(this.constructor.name, 'arcTo')
    // TODO: this doesn't mutate the arguments array yet
    const pt1 = this.transformPoint([_x1, _y1])
    const pt2 = this.transformPoint([_x2, _y2])

    this.ensurePath(pt1.x, pt1.y)

    const p0 = this.path.lastPoint() || new Point()
    const v01 = p0.clone().subtract(pt1)
    const v21 = pt2.clone().subtract(pt1)

    // sin(A - B) = sin(A) * cos(B) - sin(B) * cos(A)
    const cross = v01.x * v21.y - v01.y * v21.x

    if (Math.abs(cross) < 1e-10) {
      // on one line
      this.lineTo(pt1.x, pt1.y)
      return
    }

    const d01 = v01.magnitude()
    const d21 = v21.magnitude()
    const angle = (Math.PI - Math.abs(Math.asin(cross / (d01 * d21)))) / 2
    const span = radius * Math.tan(angle)
    let rate = span / d01

    const startPoint = new Point(pt1.x + v01.x * rate, pt1.y + v01.y * rate)

    rate = span / d21

    const endPoint = new Point(pt1.x + v21.x * rate, pt1.y + v21.y * rate)

    const midPoint = new Point((startPoint.x + endPoint.x) / 2, (startPoint.y + endPoint.y) / 2)

    const vm1 = midPoint.clone().subtract(pt1)
    const dm1 = vm1.magnitude()
    const d = Math.sqrt(radius * radius + span * span)

    const centerPoint = new Point()
    rate = d / dm1
    centerPoint.x = pt1.x + vm1.x * rate
    centerPoint.y = pt1.y + vm1.y * rate

    const arc = pointsToArc(centerPoint, startPoint, endPoint)

    this.path.lineTo(startPoint.x, startPoint.y)
    this.path.arc(centerPoint.x, centerPoint.y, arc.radius, arc.start, arc.end, cross > 0)

    this.ctx?.arcTo(pt1.x, pt1.y, pt2.x, pt2.y, radius)
  }

  public arcToRelative(_x1: number, _y1: number, _x2: number, _y2: number, radius: number) {
    const lastPoint = this.path.lastPoint()
    if (!lastPoint) return
    this.arcTo(lastPoint.x + _x1, lastPoint.y + _y1, lastPoint.x + _x2, lastPoint.y + _y2, radius)
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
    const points = arcToPoints(x, y, aStartAngle, aEndAngle, radius)

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

  public bezierCurveToRelative(...args: BezierCurveToAction['args']) {
    const lastPoint = this.path.lastPoint()
    if (!lastPoint) return
    this.bezierCurveTo(
      ...[
        lastPoint.x + args[0],
        lastPoint.y + args[1],
        lastPoint.x + args[2],
        lastPoint.y + args[3],
        lastPoint.x + args[4],
        lastPoint.y + args[5],
      ]
    )
  }

  public quadraticCurveTo(...args: QuadraticCurveToAction['args']) {
    // const [aCPx, aCPy, aX, aY] = args
    const { x: aCPx, y: aCPy } = this.transformPoint([args[0], args[1]])
    const { x: aX, y: aY } = this.transformPoint([args[2], args[3]])
    this.path.quadraticCurveTo(aCPx, aCPy, aX, aY)

    this.ctx?.quadraticCurveTo(aCPx, aCPy, aX, aY)
  }

  public quadraticCurveToRelative(...args: QuadraticCurveToAction['args']) {
    const lastPoint = this.path.lastPoint()
    if (!lastPoint) return
    this.quadraticCurveTo(
      ...[
        lastPoint.x + args[0],
        lastPoint.y + args[1],
        lastPoint.x + args[2],
        lastPoint.y + args[3],
      ]
    )
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
    if (cutout) {
      this.clearRect(x, y, w, h)
    } else {
      this.moveTo(x, y)
      this.lineTo(x + w, y)
      this.lineTo(x + w, y + h)
      this.lineTo(x, y + h)
      this.lineTo(x, y)
    }
  }

  public rectCentered: OverloadedFunctionWithOptionals<
    [pt: Point, w: number, h: number] | [x: number, y: number, w: number, h: number],
    [cutout: true]
  > = (...args) => {
    const cutout = (args.length === 4 && args[3] === true) || args.length === 5 || false
    const x = args.length === 3 || (args.length === 4 && args[3] === true) ? args[0].x : args[0]
    const y = args.length === 3 || (args.length === 4 && args[3] === true) ? args[0].y : args[1]
    const w = args.length === 3 || (args.length === 4 && args[3] === true) ? args[1] : args[2]
    const h = args.length === 3 || (args.length === 4 && args[3] === true) ? args[2] : args[3]
    if (cutout) {
      this.clearRect(x - w / 2, y - h / 2, w, h)
    } else {
      this.moveTo(x - w / 2, y - h / 2)
      this.lineTo(x + w - w / 2, y - h / 2)
      this.lineTo(x + w - w / 2, y + h - h / 2)
      this.lineTo(x - w / 2, y + h - h / 2)
      this.lineTo(x - w / 2, y - h / 2)
    }
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
    const w =
      args.length === 3 || (args.length === 4 && typeof args[3] !== 'number') ? args[1] : args[2]
    const h =
      args.length === 3 || (args.length === 4 && typeof args[3] !== 'number')
        ? args[2]
        : (args[3] as number)
    const options =
      args.length === 5
        ? args[4]
        : args.length === 4 && typeof args[3] !== 'number'
        ? args[3]
        : undefined

    if (options?.cutout && options.cutout !== clipperLib.ClipType.Union) this.clearRect(x, y, w, h)
    this.beginPath()
    this.rect(x, y, w, h)
    this.stroke(options ? { ...options, cutout: false } : undefined)
    this.closePath()
    if (options?.cutout === clipperLib.ClipType.Union) this.clearRect(x, y, w, h)
  }

  public strokeRectCentered: OverloadedFunctionWithOptionals<
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
    const w =
      args.length === 3 || (args.length === 4 && typeof args[3] !== 'number') ? args[1] : args[2]
    const h =
      args.length === 3 || (args.length === 4 && typeof args[3] !== 'number')
        ? args[2]
        : (args[3] as number)
    const options =
      args.length === 5
        ? args[4]
        : args.length === 4 && typeof args[3] !== 'number'
        ? args[3]
        : undefined

    if (options?.cutout && options.cutout !== clipperLib.ClipType.Union)
      this.clearRect(x - w / 2, y - h / 2, w, h)
    this.beginPath()
    this.rectCentered(x, y, w, h)
    this.stroke(options ? { ...options, cutout: false } : undefined)
    this.closePath()
    if (options?.cutout === clipperLib.ClipType.Union) this.clearRect(x, y, w, h)
  }

  public strokeBounds(bounds: Bounds) {
    this.strokeRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top)
  }

  public strokePath(path: IntPoint[], options?: StrokeOptions) {
    this.beginPath()
    for (let i = 0; i < path.length; i++) {
      const pt = path[i]
      if (i === 0) {
        this.moveTo(pt.x, pt.y)
      } else {
        this.lineTo(pt.x, pt.y)
      }
    }
    this.stroke(options)
    // this.closePath()
  }

  public fillRect(
    ...args: [pt: Point, w: number, h: number] | [x: number, y: number, w: number, h: number]
  ) {
    const x = args.length === 3 ? args[0].x : args[0]
    const y = args.length === 3 ? args[0].y : args[1]
    const w = args.length === 3 ? args[1] : args[2]
    const h = args.length === 3 ? args[2] : args[3]
    this.beginPath()
    this.rect(x, y, w, h)
    this.fill()
    this.closePath()
  }

  public fillRectCentered(
    ...args: [pt: Point, w: number, h: number] | [x: number, y: number, w: number, h: number]
  ) {
    const x = args.length === 3 ? args[0].x : args[0]
    const y = args.length === 3 ? args[0].y : args[1]
    const w = args.length === 3 ? args[1] : args[2]
    const h = args.length === 3 ? args[2] : args[3]
    this.beginPath()
    this.rectCentered(x, y, w, h)
    this.fill()
    this.closePath()
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

  public strokeCircle: OverloadedFunctionWithOptionals<
    [pt: Point, radius: number] | [x: number, y: number, radius: number],
    [options: StrokeOptions]
  > = (...args) => {
    const x = typeof args[0] === 'number' ? args[0] : args[0].x
    const y = typeof args[0] === 'number' ? args[1] : args[0].y
    const radius = typeof args[0] === 'number' ? (args[2] as number) : args[1]
    const options =
      args.length === 4
        ? args[3]
        : args.length === 3 && typeof args[2] !== 'number'
        ? args[2]
        : undefined

    if (options?.cutout) this.clearCircle(x, y, radius)

    this.beginPath()
    this.circle(x, y, radius)
    this.stroke(options ? { ...options, cutout: false } : undefined)
    this.closePath()
  }

  public fillCircle(...args: [pt: Point, radius: number] | [x: number, y: number, radius: number]) {
    const x = args.length === 2 ? args[0].x : args[0]
    const y = args.length === 2 ? args[0].y : args[1]
    const radius = args.length === 2 ? args[1] : args[2]
    this.beginPath()
    this.circle(x, y, radius)
    // TODO: spiral inwards instead?
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

  public strokeTriangle(
    ...args:
      | [Point, Point, Point]
      | [pt: Point, dir: number, length: number]
      | [x: number, y: number, dir: number, length: number]
  ) {
    const x1 = typeof args[0] === 'number' ? args[0] : args[0].x
    const y1 = typeof args[0] === 'number' ? (args[1] as number) : args[0].y
    let x2: number, y2: number, x3: number, y3: number
    if (typeof args[1] !== 'number') {
      x2 = args[1].x
      y2 = args[1].y
      x3 = (args[2] as Point).x
      y3 = (args[2] as Point).y
    } else {
      const dir = typeof args[0] === 'number' ? (args[2] as number) : args[1]
      const length = typeof args[0] === 'number' ? (args[3] as number) : (args[2] as number)
      x2 = x1 + Math.cos(dir + 0.25) * length
      y2 = y1 + Math.sin(dir + 0.25) * length
      x3 = x1 + Math.cos(dir - 0.25) * length
      y3 = y1 + Math.sin(dir - 0.25) * length
    }
    this.beginPath()
    this.moveTo(x1, y1)
    this.lineTo(x2, y2)
    this.lineTo(x3, y3)
    this.closePath()
    this.stroke()
  }

  public strokePolygon(
    ...args:
      | [x: number, y: number, sides: number, radius: number, angle?: number]
      | [pt: Point, sides: number, radius: number, angle?: number]
  ) {
    const x = typeof args[0] === 'number' ? args[0] : args[0].x
    const y = typeof args[0] === 'number' ? args[1] : args[0].y
    const sides = typeof args[0] === 'number' ? args[2] : args[1]
    const radius = typeof args[0] === 'number' ? args[3] : args[2]
    const startAngle = (typeof args[0] === 'number' ? args[4] : args[3]) || 0
    this.beginPath()
    for (let i = 0; i < sides; i++) {
      const angle = startAngle + (i * Math.PI * 2) / sides
      const x1 = x + Math.cos(angle) * radius
      const y1 = y + Math.sin(angle) * radius
      this.lineTo(x1, y1)
    }
    this.closePath()
    this.stroke()
  }

  public fillPolygon(
    ...args:
      | [x: number, y: number, sides: number, radius: number, angle?: number]
      | [pt: Point, sides: number, radius: number, angle?: number]
  ) {
    const x = typeof args[0] === 'number' ? args[0] : args[0].x
    const y = typeof args[0] === 'number' ? args[1] : args[0].y
    const sides = typeof args[0] === 'number' ? args[2] : args[1]
    const radius = typeof args[0] === 'number' ? args[3] : args[2]
    const startAngle = (typeof args[0] === 'number' ? args[4] : args[3]) || 0
    this.beginPath()
    for (let i = 0; i < sides; i++) {
      const angle = startAngle + (i * Math.PI * 2) / sides
      const x1 = x + Math.cos(angle) * radius
      const y1 = y + Math.sin(angle) * radius
      this.lineTo(x1, y1)
    }
    this.closePath()
    this.fill()
  }

  public strokeSvgPath(path: string | SimplifiedSvgPathSegment[]) {
    const commands = typeof path === 'string' ? pathToCanvasCommands(path, true) : path
    if (!commands.length) return
    if (commands[0].type !== 'M') throw new Error('First command must be a move command')
    this.beginPath()
    this.moveTo(commands[0].values[0], commands[0].values[1])
    for (let i = 1; i < commands.length; i++) {
      const command = commands[i]
      if (command.type === 'M') {
        this.stroke()
        this.closePath()
        this.beginPath()
        this.moveTo(command.values[0], command.values[1])
      } else if (command.type === 'L') {
        this.lineTo(command.values[0], command.values[1])
      } else if (command.type === 'C') {
        this.bezierCurveTo(
          command.values[0],
          command.values[1],
          command.values[2],
          command.values[3],
          command.values[4],
          command.values[5]
        )
      } else if (command.type === 'Z') {
        this.lineTo(commands[0].values[0], commands[0].values[1])
      }
    }
    this.stroke()
  }

  public clone() {
    //
  }

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

  public stroke({
    align = this.align,
    depth = this.depth,
    cutout,
    debug,
    debugColor,
  }: StrokeOptions = {}) {
    if (!this.isOpaque(this.strokeStyle)) return

    const origStrokeStyle = this.ctx.strokeStyle
    if (debug) {
      this.ctx.strokeStyle = debugColor || 'rgba(255,0,0,0.5)'
    } else {
      let path = this.path

      if (cutout) {
        if (this.pathHistory.length > 0) {
          this.cutOutShape(path)
          /*
          const currentLines = convertPointsToEdges(path.getPoints())
          console.log('lines making up current shape:', currentLines)
          console.log('previously stored shapes: ', this.pathHistory.length)
          for (let i = this.pathHistory.length - 1; i >= 0; i--) {
            const compareLines = convertPointsToEdges(this.pathHistory[i].getPoints())
            console.log(`history item ${i} lines:`, compareLines)
          }
          */
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
        // ClipperLib.Clipper.simplifyPolygons ??? maybe
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

    if (cutout) {
      const prevFillStyle = this.ctx.fillStyle
      this.ctx.fillStyle = this._background
      this.ctx.fill()
      this.ctx.fillStyle = prevFillStyle
    }
    this.ctx.stroke()

    if (debug) this.ctx.strokeStyle = origStrokeStyle
  }

  public fill(windingRule?: WindingRule) {
    if (!this.isOpaque(this.fillStyle)) return

    this.save()

    if (!this.toolDiameter) throw 'You must set context.toolDiameter to use fill()'

    let path = this.path
    path = path.simplify(windingRule, this.precision)
    path = path.clip(this.clipRegion, ClipType.intersection, this.precision)
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

  public cutOutShape(shape: Path, clipType = clipperLib.ClipType.Difference) {
    const SCALE = 1000

    const cutoutRectPtsTransformed = shape.getPoints().map((pt) => ({
      x: Math.round(pt.x * SCALE),
      y: Math.round(pt.y * SCALE),
    }))

    console.log('------------------------------------')
    console.log('CLEARING all GCode and starting again')
    this.motion.reset()
    this.driver.reset()

    // console.log(cutoutRectPtsTransformed)

    for (let i = 0; i < this.pathHistory.length; i++) {
      const subPath = this.pathHistory[i]

      const oldPts = subPath.getPoints()
      const oldPtsTransformed = oldPts.map((pt) => ({
        x: Math.round(pt.x * SCALE),
        y: Math.round(pt.y * SCALE),
      }))
      // console.log(oldPtsTransformed)

      if (clipper) {
        // const myClipper = new clipper.instance.Clipper(0)
        const cleaned = clipper.cleanPolygon(oldPtsTransformed)
        const subject = cleaned.length ? cleaned : oldPtsTransformed

        try {
          const diffPath = clipper.clipToPolyTree({
            clipType,
            subjectInputs: [{ data: subject, closed: false }],
            clipInputs: [{ data: cutoutRectPtsTransformed }],
            subjectFillType: clipperLib.PolyFillType.NonZero,
            clipFillType: clipperLib.PolyFillType.NonZero,
          })

          const lengthDiff = Math.abs(subject.length - diffPath.total)
          if (lengthDiff > 0 && cleaned.length !== 0) {
            // const pts = []
            subPath.pointsCache[DEFAULT_DIVISIONS] = []
            subPath.hasBeenCutInto = true
            subPath.actions = []
            let node = diffPath.getFirst()
            while (node) {
              const pts = node.contour.map((pt) => new Point(pt.x / SCALE, pt.y / SCALE))
              subPath.addAction({
                type: 'MOVE_TO',
                args: [pts[0].x, pts[0].y],
              })
              for (const pt of pts)
                subPath.addAction({
                  type: 'LINE_TO',
                  args: [pt.x, pt.y],
                })

              node = node.getNext()
            }
          }
        } catch (e) {
          console.log('unable to clip shape', subPath)
        }
      } else {
        console.log('clipper not loaded yet')
      }
    }

    for (const subPath of this.pathHistory) {
      this.layer(subPath, (z) => {
        this.motion.followPath(subPath, z)
      })
    }
  }

  public clearRect(
    ...args:
      | [pt: Point, width: number, height: number]
      | [x: number, y: number, width: number, height: number]
  ) {
    const x = args.length === 3 ? args[0].x : args[0]
    const y = args.length === 3 ? args[0].y : args[1]
    const width = args.length === 3 ? args[1] : args[2]
    const height = args.length === 3 ? args[2] : args[3]

    console.log('clearRect', this.path, this.subPaths)

    // do it on canvas
    // this.ctx.clearRect(x, y, width, height)
    const prevFillStyle = this.ctx.fillStyle
    this.ctx.fillStyle = this._background
    this.ctx.fillRect(x, y, width, height)
    this.ctx.fillStyle = prevFillStyle

    // do it on existing paths
    const cutOutRect = new Path([
      this.transformPoint([x, y]),
      this.transformPoint([x + width, y]),
      this.transformPoint([x + width, y + height]),
      this.transformPoint([x, y + height]),
      this.transformPoint([x, y]),
    ])

    this.cutOutShape(cutOutRect)
  }

  public clearCircle(
    ...args: [pt: Point, radius: number] | [x: number, y: number, radius: number]
  ): void {
    const x = args.length === 2 ? args[0].x : args[0]
    const y = args.length === 2 ? args[0].y : args[1]
    const radius = args.length === 2 ? args[1] : args[2]

    // do it on canvas
    // this.ctx.clearRect(x, y, width, height)
    const prevFillStyle = this.ctx.fillStyle
    this.ctx.fillStyle = this._background
    this.ctx.beginPath()
    this.ctx.arc(x, y, radius, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.closePath()
    this.ctx.fillStyle = prevFillStyle

    const pts = ellipseToPoints(x, y, radius, radius, 0, Math.PI * 2, false, DEFAULT_DIVISIONS)
    const cutoutCircle = new Path(pts.map((pt) => this.transformPoint([pt.x, pt.y])))

    this.cutOutShape(cutoutCircle)
  }

  public closePath() {
    this.path.close()
    if (this.enableCutouts && this.path.current) this.pathHistory.push(this.path.current.clone())
    this.ctx?.closePath()
  }

  /**
   * Note: this closes current path and begins a new one.
   * You have to call stroke or fill afterwards
   */
  public clipCurrentPath({
    clipType,
    subjectFillType = clipperLib.PolyFillType.NonZero,
    clipFillType = clipperLib.PolyFillType.NonZero,
    subjectIsOpen = false,
    inputsAreOpen = false,
    reverseSolution = false,
    detailScale = 1000,
    pathDivisions = DEFAULT_DIVISIONS,
  }: {
    clipType: clipperLib.ClipType
    subjectFillType?: clipperLib.PolyFillType
    clipFillType?: clipperLib.PolyFillType
    pathsAreOpen?: boolean
    subjectIsOpen?: boolean
    inputsAreOpen?: boolean
    reverseSolution?: boolean
    detailScale?: number
    pathDivisions?: number
  }) {
    if (!this.path) {
      console.warn('no paths drawn!')
      return
    }

    const paths = this.path.subPaths

    const diffPath = clipper.clipToPolyTree({
      clipType,
      subjectInputs: (clipType === clipperLib.ClipType.Union ? paths : [paths[0]]).map((path) => ({
        data: path.getPoints(pathDivisions).map((pt) => pt.scale(detailScale)),
        closed: !subjectIsOpen,
      })),
      clipInputs:
        clipType === clipperLib.ClipType.Union
          ? undefined
          : paths.slice(1).map((path) => ({
              data: path.getPoints(pathDivisions).map((pt) => pt.scale(detailScale)),
              closed: !inputsAreOpen,
            })),
      reverseSolution,
      subjectFillType,
      clipFillType,
    })

    // console.log('diffPath', diffPath)
    const intersected = diffPath.total < paths.length

    let node = diffPath.getFirst()

    this.path.subPaths = []

    const ptPts: Point[][] = []
    while (node) {
      // console.log('contour', node.contour)
      const pts = node.contour.map((pt) => new Point(pt.x / detailScale, pt.y / detailScale))
      this.path.subPaths.push(new SubPath(pts))
      ptPts.push(pts)
      node = node.getNext()
    }
    this.path.current = this.path.subPaths[this.path.subPaths.length - 1]

    if (!subjectIsOpen) this.ctx.closePath()

    this.ctx.beginPath()
    for (const pts of ptPts) {
      this.ctx.moveTo(pts[0].x, pts[0].y)
      for (const pt of pts) {
        this.ctx.lineTo(pt.x, pt.y)
      }
      if (!subjectIsOpen) this.ctx.lineTo(pts[0].x, pts[0].y)
    }
    // this.ctx.stroke()
    // this.ctx.closePath()

    return { intersected }
  }

  public offsetPath(
    path: SubPath | Point[],
    offset: number,
    { joinType, endType, precision }: OffsetOptions = defaultOffsetOptions
  ) {
    const pathPts = (path instanceof SubPath ? path.getPoints() : path).map((pt) =>
      pt.scale(precision)
    )
    const offsetPaths = clipper.offsetToPaths({
      delta: offset * precision,
      offsetInputs: [
        {
          data: pathPts,
          joinType,
          endType,
        },
      ],
    })
    const paths = offsetPaths.map((offsetPath) =>
      [...offsetPath, offsetPath[0]].map((pt) => new Point(pt.x / precision, pt.y / precision))
    )
    return paths
  }

  public strokeOffsetPath(
    offset: number,
    { joinType, endType, precision }: OffsetOptions = defaultOffsetOptions
  ) {
    const subPaths = this.path.subPaths
    for (const subPath of subPaths) {
      const offsetPaths = this.offsetPath(subPath, offset, { joinType, endType, precision }).sort(
        (a, b) => a.length - b.length
      )
      for (const offsetPath of offsetPaths) {
        this.beginPath()
        this.moveTo(offsetPath[0].x, offsetPath[0].y)
        for (let i = 1; i < offsetPath.length; i++) {
          this.lineTo(offsetPath[i].x, offsetPath[i].y)
        }
        this.stroke()
        this.closePath()
      }
    }
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
