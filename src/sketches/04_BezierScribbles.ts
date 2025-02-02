import { deg360 } from '../constants/angles'
import Point from '../Point'
import { Sketch } from '../Sketch'
import { randInt } from '../utils/numberUtils'
import Range from './tools/Range'

export default class BezierScribbles extends Sketch {
  static generateGCode = false
  static enableCutouts = false
  // startPoint: Point
  lastPoint: Point
  lastAnchorPoint: Point

  init() {
    this.vs.stopAfter = new Range({ initialValue: 5, min: 1, max: 200, step: 1 })
    this.vs.driftMin = new Range({ initialValue: 20, min: 0, max: 100, step: 1 })
    this.vs.driftMax = new Range({ initialValue: 50, min: 0, max: 100, step: 1 })
    this.vs.midpointDrift = new Range({ initialValue: 30, min: 0, max: 100, step: 1 })
  }

  initDraw(): void {
    const dir = Math.random() * deg360
    this.lastPoint = new Point(this.cx + Math.cos(dir) * 100, this.cy + +Math.sin(dir) * 100)
    this.lastAnchorPoint = this.lastPoint.clone()
  }

  draw(increment: number): void {
    // console.log(increment)
    if (increment > this.vs.stopAfter.value) return

    const endPoint = new Point(
      this.lastPoint.x +
        Math.cos(Math.random() * deg360) *
          (this.vs.driftMin.value +
            Math.random() * (this.vs.driftMax.value - this.vs.driftMin.value)),
      this.lastPoint.y +
        Math.sin(Math.random() * deg360) *
          (this.vs.driftMin.value +
            Math.random() * (this.vs.driftMax.value - this.vs.driftMin.value))
    )

    endPoint.x += (this.cx - endPoint.x) / 15
    endPoint.y += (this.cy - endPoint.y) / 15

    const angle = this.lastAnchorPoint.angleTo(this.lastPoint)
    const dist = this.lastAnchorPoint.distanceTo(this.lastPoint)

    const midPoint = this.lastAnchorPoint
      .add(new Point(Math.cos(angle) * (dist * 2), Math.sin(angle) * (dist * 2)))
      .add(new Point(randInt(this.vs.midpointDrift.value), randInt(this.vs.midpointDrift.value)))

    midPoint.x += (this.cx - midPoint.x) / 15
    midPoint.y += (this.cy - midPoint.y) / 15

    // debugDot(this.ctx, midPoint.x, midPoint.y, '#00f')
    // debugDot(this.ctx, endPoint.x, endPoint.y, '#f00')

    this.ctx.beginPath()
    this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y)
    this.ctx.bezierCurveTo(midPoint.x, midPoint.y, midPoint.x, midPoint.y, endPoint.x, endPoint.y)
    this.ctx.stroke()
    this.ctx.endPath()

    this.lastPoint = endPoint.clone()
    this.lastAnchorPoint = midPoint.clone()
  }
}
