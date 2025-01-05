import Point from '../Point'
import { Sketch } from '../Sketch'
import { initPen, plotBounds } from '../utils/penUtils'
import Osc from './tools/Osc'

const { PI } = Math
export default class Spiraling extends Sketch {
  // static generateGCode = false
  static enableCutouts = false

  //
  //
  //
  //
  //
  //
  //
  //
  //

  OSCs: Osc[] = []
  lastPoint: Point
  init() {
    const scaleDown = 15
    this.addVar('speedUp', { initialValue: 10, min: 1, max: 100, step: 1, disableRandomize: true }) // prettier-ignore
    this.addVar('stopAfter', { initialValue: 50000, min: 1, max: 120000, step: 1, disableRandomize: true }) // prettier-ignore
    this.addVar('osc1speed', { initialValue: 0.1, min: -PI / 8, max: PI / 8, step: PI / 666 }) // 666 is actually important
    this.addVar('osc1dist', { initialValue: PI / 4 / scaleDown, min: PI / 8 / scaleDown, max: (PI * 16) / scaleDown, step: PI / 32 / scaleDown }) // prettier-ignore
    this.addVar('osc1phase', { initialValue: 0, min: 0, max: PI * 2, step: PI / 16 })
    this.addVar('osc2speed', { initialValue: 0.1, min: -PI / 8, max: PI / 8, step: PI / 666 }) // 666 is actually important
    this.addVar('osc2dist', { initialValue: PI / 4 / scaleDown, min: PI / 8 / scaleDown, max: (PI * 16) / scaleDown, step: PI / 32 / scaleDown }) // prettier-ignore
    this.addVar('osc2phase', { initialValue: 0, min: 0, max: PI * 2, step: PI / 16 })
    this.addVar('osc3speed', { initialValue: 0.1, min: -PI / 8, max: PI / 8, step: PI / 666 }) // 666 is actually important
    this.addVar('osc3dist', { initialValue: PI / 4 / scaleDown, min: PI / 8 / scaleDown, max: (PI * 16) / scaleDown, step: PI / 32 / scaleDown }) // prettier-ignore
    this.addVar('osc3phase', { initialValue: 0, min: 0, max: PI * 2, step: PI / 16 })
    this.OSCs[0] = new Osc({ speed: (i) => this.vars.osc1speed, radius: (i) => this.vars.osc1dist, phase: 0 }) // prettier-ignore
    this.OSCs[1] = new Osc({ speed: (i) => this.vars.osc2speed, radius: (i) => this.vars.osc2dist, phase: 0 }) // prettier-ignore
    this.OSCs[2] = new Osc({ speed: (i) => this.vars.osc3speed, radius: (i) => this.vars.osc3dist, phase: 0 }) // prettier-ignore
  }
  initDraw(): void {
    initPen(this)
    plotBounds(this)
    this.lastPoint = new Point(this.cx, this.cy)
    this.vs.stopAfter.step = this.vs.speedUp.value
    this.OSCs[0].phase = this.vars.osc1phase
    this.OSCs[1].phase = this.vars.osc2phase
    this.OSCs[2].phase = this.vars.osc3phase
    this.OSCs[0].reset()
    this.OSCs[1].reset()
    this.OSCs[2].reset()
  }
  draw(increment: number): void {
    if (increment * this.vars.speedUp > this.vars.stopAfter) return
    for (let i = 0; i < this.vars.speedUp; i++) {
      for (let o = 0; o < 3; o++) this.OSCs[o].step(increment)
      const point = this.lastPoint.clone().add(this.OSCs[0].value.add(this.OSCs[1].value).add(this.OSCs[2].value)) // prettier-ignore
      this.ctx.beginPath()
      this.ctx.strokeLine(this.lastPoint, point)
      this.lastPoint = point
    }
  }

  //
  //
  //
  //
  //
  //
  //
}
