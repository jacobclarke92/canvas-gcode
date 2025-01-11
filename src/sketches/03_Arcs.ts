import { deg360 } from '../constants/angles'
import Path from '../Path'
import Point from '../Point'
import { Sketch } from '../Sketch'
import { arcToPoints } from '../utils/pathUtils'
import Osc from './tools/Osc'

export default class Arcs extends Sketch {
  osc: Osc
  circlePoints: Point[]
  count = 0
  lastPoint: Point

  init() {
    this.addVar('precision', { initialValue: 180, min: 2, max: 1440, step: 1 })
    this.addVar('speedPow1', { initialValue: 0.5, min: 0.001, max: 10, step: 0.001 })
    this.addVar('radiusMin', { initialValue: 0.1, min: 1, max: 20, step: 0.1 })
    this.addVar('radiusMax', { initialValue: 0.5, min: 1, max: 20, step: 0.1 })
    this.addVar('radiusThetaMulti', { initialValue: 1, min: 0.001, max: 5, step: 0.001 })
  }
  initDraw(): void {
    const { radiusMax, radiusMin, radiusThetaMulti } = this.vars
    this.count = 0
    this.lastPoint = undefined
    this.osc = new Osc({
      speed: (i) => {
        const value = Math.sqrt(i) / -Math.pow(Math.sqrt(i), this.vars.speedPow1)
        return isNaN(value) ? 0 : value
      },
      radius: (i) =>
        new Point(
          radiusMin + Math.cos(i * radiusThetaMulti) * radiusMax,
          radiusMin + Math.sin(i * radiusThetaMulti) * radiusMax
        ),
    })
    const radius = Math.min(this.cw, this.ch) / 2 - (radiusMax + 10)
    const { start: startPoint } = arcToPoints(this.cx, this.cy, 0, deg360, radius)
    const tmp = new Path()
    tmp.moveTo(startPoint.x, startPoint.y)
    tmp.arc(this.cx, this.cy, radius, 0, deg360, false)
    this.circlePoints = tmp.getPoints(this.vars.precision)
  }
  draw(increment: number): void {
    if (++this.count > this.circlePoints.length) return
    this.osc.step(this.count + 1)
    const p = this.circlePoints[this.count - 1]
    const point = new Point(p.x + this.osc.x, p.y + this.osc.y)
    if (this.lastPoint && p) {
      this.ctx.beginPath()
      this.ctx.strokeLine(this.lastPoint, point)
    }
    this.lastPoint = point.clone()
  }
}
