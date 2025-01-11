import Point from '../Point'
import { Sketch } from '../Sketch'
import { initPen, penUp, plotBounds } from '../utils/penUtils'
import Osc from './tools/Osc'
import Range from './tools/Range'

export default class SpiralingProportional extends Sketch {
  // static generateGCode = false
  static enableCutouts = false
  osc1: Osc
  osc2: Osc
  osc3: Osc
  lastPoint: Point

  init() {
    this.vs.speedUp = new Range({
      initialValue: 15,
      min: 1,
      max: 100,
      step: 1,
      disableRandomize: true,
    })
    this.vs.stopAfter = new Range({
      initialValue: 1000,
      min: 1,
      max: 20000,
      step: 1,
      disableRandomize: true,
    })
    this.vs.oscSpeed = new Range({
      initialValue: 0.1825,
      min: -Math.PI / 8,
      max: Math.PI / 8,
      step: Math.PI / 666,
    })
    this.vs.oscSpeedMulti = new Range({ initialValue: 2.994, min: 0.5, max: 5, step: 0.00001 })
    this.vs.oscDist = new Range({ initialValue: 50, min: 1, max: 50, step: 0.25 })
    this.vs.osc1phase = new Range({
      initialValue: 5.9,
      min: 0,
      max: Math.PI * 2,
      step: Math.PI / 128,
    })
    this.vs.osc2phase = new Range({
      initialValue: 1.8,
      min: 0,
      max: Math.PI * 2,
      step: Math.PI / 128,
    })
    this.vs.osc3phase = new Range({
      initialValue: 2,
      min: 0,
      max: Math.PI * 2,
      step: Math.PI / 128,
    })
    this.osc1 = new Osc({
      speed: (i) => (this.vs.oscSpeed.value * this.vs.oscSpeedMulti.value) / 2,
      radius: (i) => this.vs.oscDist.value,
      phase: 0,
    })
    this.osc2 = new Osc({
      speed: (i) => (this.vs.oscSpeed.value * Math.pow(this.vs.oscSpeedMulti.value, 2)) / 2,
      radius: (i) => this.vs.oscDist.value,
      phase: 0,
    })
    this.osc3 = new Osc({
      speed: (i) => (this.vs.oscSpeed.value * Math.pow(this.vs.oscSpeedMulti.value, 3)) / 3,
      radius: (i) => this.vs.oscDist.value,
      phase: 0,
    })
    this.vs.offsetX = new Range({ initialValue: 1, min: -250, max: 250, step: 1 })
    this.vs.offsetY = new Range({ initialValue: 1, min: -250, max: 250, step: 1 })
  }

  initDraw(): void {
    initPen(this)
    plotBounds(this)
    this.lastPoint = new Point(this.cx + this.vs.offsetX.value, this.cy + this.vs.offsetY.value)
    this.vs.stopAfter.step = this.vs.speedUp.value
    this.osc1.phase = this.vs.osc1phase.value
    this.osc2.phase = this.vs.osc2phase.value
    this.osc3.phase = this.vs.osc3phase.value
    this.osc1.reset()
    this.osc2.reset()
    this.osc3.reset()
  }

  draw(increment: number): void {
    const loop = this.vs.speedUp.value
    if (increment * loop > this.vs.stopAfter.value) {
      penUp(this)
      return
    }
    for (let i = 0; i < loop; i++) {
      this.osc1.step(increment)
      this.osc2.step(increment)
      this.osc3.step(increment)
      // const point = this.lastPoint.clone().add(this.osc1.value).add(this.osc2.value).add(this.osc3.value)
      const point = this.lastPoint
        .clone()
        .add(this.osc1.value.add(this.osc2.value).add(this.osc3.value))

      this.ctx.beginPath()
      this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y)
      this.ctx.lineTo(point.x, point.y)
      this.ctx.stroke()
      this.ctx.endPath()

      this.lastPoint = point
    }
  }
}
