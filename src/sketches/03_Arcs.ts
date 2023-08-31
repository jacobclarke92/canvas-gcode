import Path from '../Path'
import Point from '../Point'
import { Sketch } from '../Sketch'
import { arcToPoints } from '../utils/pathUtils'
import Osc from './tools/Osc'
import Range from './tools/Range'

export default class Arcs extends Sketch {
  osc: Osc
  circlePoints: Point[]
  count = 0
  lastPoint: Point

  init() {
    this.vs.precision = new Range({ initialValue: 180, min: 2, max: 1440, step: 1 })
    this.vs.speedPow1 = new Range({ initialValue: 0.5, min: 0.001, max: 10, step: 0.001 })
    this.vs.radiusMin = new Range({ initialValue: 0.1, min: 1, max: 20, step: 0.1 })
    this.vs.radiusMax = new Range({ initialValue: 0.5, min: 1, max: 20, step: 0.1 })
    this.vs.radiusThetaMulti = new Range({ initialValue: 1, min: 0.001, max: 5, step: 0.001 })

    this.osc = new Osc({
      speed: (i) => {
        const value = Math.sqrt(i) / -Math.pow(Math.sqrt(i), this.vs.speedPow1.value)
        return isNaN(value) ? 0 : value
      },
      radius: (i) =>
        new Point(
          this.vs.radiusMin.value + Math.cos(i * this.vs.radiusThetaMulti.value) * this.vs.radiusMax.value,
          this.vs.radiusMin.value + Math.sin(i * this.vs.radiusThetaMulti.value) * this.vs.radiusMax.value
        ),
    })
  }

  initDraw(): void {
    if (this.vs.radiusMin.value > this.vs.radiusMax.value) this.vs.radiusMax.setValue(this.vs.radiusMin.value, true)

    console.log({
      precision: this.vs.precision.value,
      speedPow1: this.vs.speedPow1.value,
      radiusMin: this.vs.radiusMin.value,
      radiusMax: this.vs.radiusMax.value,
      radiusThetaMulti: this.vs.radiusThetaMulti.value,
    })

    this.count = 0
    this.lastPoint = undefined
    this.osc.reset()

    const radius = Math.min(this.cw, this.ch) / 2 - (this.vs.radiusMax.value + 10)
    const { start: startPoint } = arcToPoints(this.cx, this.cy, 0, Math.PI * 2, radius)

    const tmp = new Path()
    tmp.moveTo(startPoint.x, startPoint.y)
    tmp.arc(this.cx, this.cy, radius, 0, Math.PI * 2, false)
    this.circlePoints = tmp.getPoints(this.vs.precision.value)

    // this.lastPoint = startPoint.clone()
  }

  draw(increment: number): void {
    if (this.count >= this.circlePoints.length) return

    this.osc.step(this.count + 1)
    const p = this.circlePoints[this.count]
    const point = new Point(p.x + this.osc.x, p.y + this.osc.y)

    if (this.lastPoint && p) {
      this.ctx.beginPath()
      this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y)
      this.ctx.lineTo(point.x, point.y)
      this.ctx.stroke()
      this.ctx.closePath()
    }

    this.lastPoint = point.clone()

    this.count++
  }
}
