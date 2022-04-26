import Point from '../Point'
import { Sketch } from '../Sketch'
import Osc from './tools/Osc'
import Range from './tools/Range'

export default class Spiraling extends Sketch {
  // static generateGCode = false
  osc1: Osc
  osc2: Osc
  osc3: Osc
  lastPoint: Point

  init() {
    const scaleDown = 15
    this.vs.speedUp = new Range({ initialValue: 10, min: 1, max: 100, step: 1, disableRandomize: true })
    this.vs.stopAfter = new Range({ initialValue: 50000, min: 1, max: 120000, step: 1, disableRandomize: true })
    this.vs.osc1speed = new Range({ initialValue: 0.1, min: -Math.PI / 8, max: Math.PI / 8, step: Math.PI / 666 }) // 666 is actually important
    this.vs.osc1dist = new Range({
      initialValue: Math.PI / 4 / scaleDown,
      min: Math.PI / 8 / scaleDown,
      max: (Math.PI * 16) / scaleDown,
      step: Math.PI / 32 / scaleDown,
    })
    this.vs.osc1phase = new Range({ initialValue: 0, min: 0, max: Math.PI * 2, step: Math.PI / 16 })
    this.vs.osc2speed = new Range({ initialValue: 0.1, min: -Math.PI / 8, max: Math.PI / 8, step: Math.PI / 666 }) // 666 is actually important
    this.vs.osc2dist = new Range({
      initialValue: Math.PI / 4 / scaleDown,
      min: Math.PI / 8 / scaleDown,
      max: (Math.PI * 16) / scaleDown,
      step: Math.PI / 32 / scaleDown,
    })
    this.vs.osc2phase = new Range({ initialValue: 0, min: 0, max: Math.PI * 2, step: Math.PI / 16 })
    this.vs.osc3speed = new Range({ initialValue: 0.1, min: -Math.PI / 8, max: Math.PI / 8, step: Math.PI / 666 }) // 666 is actually important
    this.vs.osc3dist = new Range({
      initialValue: Math.PI / 4 / scaleDown,
      min: Math.PI / 8 / scaleDown,
      max: (Math.PI * 16) / scaleDown,
      step: Math.PI / 32 / scaleDown,
    })
    this.vs.osc3phase = new Range({ initialValue: 0, min: 0, max: Math.PI * 2, step: Math.PI / 16 })
    this.osc1 = new Osc({ speed: (i) => this.vs.osc1speed.value, radius: (i) => this.vs.osc1dist.value, phase: 0 })
    this.osc2 = new Osc({ speed: (i) => this.vs.osc2speed.value, radius: (i) => this.vs.osc2dist.value, phase: 0 })
    this.osc3 = new Osc({ speed: (i) => this.vs.osc3speed.value, radius: (i) => this.vs.osc3dist.value, phase: 0 })
  }

  initDraw(): void {
    this.lastPoint = new Point(this.cx, this.cy)
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
    if (increment * loop > this.vs.stopAfter.value) return
    for (let i = 0; i < loop; i++) {
      this.osc1.step(increment)
      this.osc2.step(increment)
      this.osc3.step(increment)
      // const point = this.lastPoint.clone().add(this.osc1.value).add(this.osc2.value).add(this.osc3.value)
      const point = this.lastPoint.clone().add(this.osc1.value.add(this.osc2.value).add(this.osc3.value))

      this.ctx.beginPath()
      this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y)
      this.ctx.lineTo(point.x, point.y)
      this.ctx.stroke()
      this.ctx.closePath()

      this.lastPoint = point
    }
  }
}
