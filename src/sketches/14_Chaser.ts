import Point from '../Point'
import { Sketch } from '../Sketch'
import { degToRad, normalizeRadian, randFloat, randFloatRange, wrap } from '../utils/numberUtils'
import { random, seedRandom } from '../utils/random'
import Range from './tools/Range'

export default class Chaser extends Sketch {
  // static generateGCode = false

  init() {
    this.vs.downscaleDrawing = new Range({ initialValue: 5, min: 1, max: 200, step: 0.01, disableRandomize: true })
    this.vs.speedUp = new Range({ initialValue: 1, min: 1, max: 500, step: 1, disableRandomize: true })
    this.vs.stopAfter = new Range({ initialValue: 70000, min: 1, max: 100000, step: 100, disableRandomize: true })
    this.vs.seed = new Range({ initialValue: 2222, min: 1000, max: 5000, step: 1 })
    this.vs.angleDiff = new Range({ initialValue: 23, min: 0, max: 180, step: 1 })
    this.vs.minAngleDiff = new Range({ initialValue: 7, min: 0, max: 180, step: 1 })
    this.vs.angleChangeSpeed = new Range({ initialValue: 68, min: 0, max: 60 * 20, step: 1 })
    this.vs.easeToAngle = new Range({ initialValue: 25, min: 1, max: 60, step: 0.25 })
    this.vs.centerForce = new Range({ initialValue: 450, min: 2, max: 1200, step: 1 })
    this.vs.travel = new Range({ initialValue: 0.1, min: 0.001, max: 1, step: 0.001 })
    this.vs.centerDistRatio = new Range({ initialValue: 40, min: -10, max: 80, step: 0.01 })
  }

  point: Point
  pointAngle: number
  aimAngle: number
  angleChangeCountdown = 0
  increment = 0

  initDraw(): void {
    if (this.vs.minAngleDiff.value > this.vs.angleDiff.value)
      this.vs.minAngleDiff.setValue(this.vs.angleDiff.value, true)

    seedRandom(this.vs.seed.value)
    this.point = new Point(randFloatRange(this.cw), randFloatRange(this.ch))
    this.pointAngle = randFloatRange(Math.PI * 2)
    this.aimAngle = this.pointAngle
    this.increment = 0
    this.angleChangeCountdown = 0
  }

  draw(increment: number): void {
    if (this.increment > this.vs.stopAfter.value) return
    const angleDiff = degToRad(this.vs.angleDiff.value)
    const minAngleDiff = degToRad(this.vs.minAngleDiff.value)
    for (let i = 0; i < this.vs.speedUp.value; i++) {
      this.increment++
      if (this.increment > this.vs.stopAfter.value) break
      if (this.angleChangeCountdown <= 0) {
        let randAngle = randFloat(angleDiff - minAngleDiff)
        randAngle += (randAngle > 0 ? 1 : -1) * minAngleDiff
        this.aimAngle = this.pointAngle + randAngle
        this.aimAngle = normalizeRadian(this.aimAngle)
        this.pointAngle = normalizeRadian(this.pointAngle)
        // this.pointAngle += randAngle
        this.angleChangeCountdown = this.vs.angleChangeSpeed.value
      }
      const centerDist = Math.max(0.5, Point.distance(this.point, new Point(this.cx, this.cy)))
      // const inverseCenterDist = Math.max(0, this.cw - centerDist)

      this.pointAngle += (this.aimAngle - this.pointAngle) / this.vs.easeToAngle.value

      this.ctx.beginPath()
      this.ctx.moveTo(
        (this.point.x - this.cx) / this.vs.downscaleDrawing.value + this.cx,
        (this.point.y - this.cy) / this.vs.downscaleDrawing.value + this.cy
      )
      this.point.x += Math.cos(this.pointAngle) * this.vs.travel.value
      this.point.y += Math.sin(this.pointAngle) * this.vs.travel.value
      this.point.x +=
        (this.cx - this.point.x) / (this.vs.centerForce.value * (centerDist / this.vs.centerDistRatio.value))
      this.point.y +=
        (this.cy - this.point.y) / (this.vs.centerForce.value * (centerDist / this.vs.centerDistRatio.value))
      this.ctx.lineTo(
        (this.point.x - this.cx) / this.vs.downscaleDrawing.value + this.cx,
        (this.point.y - this.cy) / this.vs.downscaleDrawing.value + this.cy
      )
      this.ctx.stroke()
      this.ctx.closePath()
      // this.point.x = wrap(this.point.x, this.cw)
      // this.point.y = wrap(this.point.y, this.ch)
      this.angleChangeCountdown--
    }
  }
}
