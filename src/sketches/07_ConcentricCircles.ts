import Point from '../Point'
import { Sketch } from '../Sketch'
import { initPen, penUp } from '../utils/penUtils'
import Osc from './tools/Osc'
import Range from './tools/Range'

export default class ConcentricCircles extends Sketch {
  // static generateGCode = false
  static enableCutouts = false

  lastPoint: Point
  radius: number
  theta: number
  osc1: Osc

  init() {
    this.vs.speedUp = new Range({
      initialValue: 4,
      min: 1,
      max: 100,
      step: 1,
      disableRandomize: true,
    })
    this.vs.stopAfter = new Range({
      initialValue: 228,
      min: 1,
      max: 1000,
      step: 1,
      disableRandomize: true,
    })
    this.vs.shrinkAmount = new Range({
      initialValue: 0.26,
      min: 0.1,
      max: 12,
      step: 0.02,
    })
    this.vs.shrinkDiv = new Range({
      initialValue: 0.29,
      min: 0,
      max: 1.8,
      step: 0.01,
    })
    this.vs.shrinkFalloff = new Range({
      initialValue: 1,
      min: 0.9,
      max: 1.1,
      step: 0.005,
    })
    this.vs.shrinkVariance = new Range({
      initialValue: 0.03,
      min: 0,
      max: 50,
      step: 0.01,
    })
    this.vs.shrinkVarOsc = new Range({
      initialValue: 0.56,
      min: 0,
      max: Math.PI / 4,
      step: 0.001,
    })
    this.vs.rotateSpeed = new Range({
      initialValue: 0.05,
      min: -Math.PI / 4,
      max: Math.PI / 4,
      step: 0.001,
    })
    this.osc1 = new Osc({
      radius: (i) => this.vs.shrinkVariance.value,
      speed: (i) => this.vs.shrinkVarOsc.value,
      phase: 0,
    })
  }

  initDraw(): void {
    initPen(this)
    this.lastPoint = new Point(this.cx, this.cy)
    this.radius = Math.min(this.cw, this.ch) * 0.45
    this.theta = 0
    this.osc1.reset()
  }

  draw(increment: number): void {
    const loop = this.vs.speedUp.value
    if (increment * loop > this.vs.stopAfter.value) {
      penUp(this)
      return
    }
    for (let i = 0; i < loop; i++) {
      const realIncrement = increment * loop + i

      this.osc1.step(realIncrement)

      if (this.radius > 0) {
        this.ctx.beginPath()
        this.ctx.circle(this.lastPoint.x, this.lastPoint.y, this.radius)
        this.ctx.stroke()
        this.ctx.closePath()
      }

      this.theta += this.vs.rotateSpeed.value

      const nextRadius =
        this.radius -
        (this.vs.shrinkAmount.value + this.osc1.x) *
          Math.pow(this.vs.shrinkFalloff.value, realIncrement)
      const radDiff = this.radius - nextRadius

      this.lastPoint = this.lastPoint.moveAlongAngle(this.theta, radDiff * this.vs.shrinkDiv.value)
      this.radius = nextRadius
    }
  }
}
