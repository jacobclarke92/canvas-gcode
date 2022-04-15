import { Sketch } from '../Sketch'

export default class GCodeTest extends Sketch {
  init() {
    this.ctx.beginPath()
    this.ctx.moveTo(100, 100)
    this.ctx.lineTo(200, 100)
    this.ctx.stroke()
    this.ctx.closePath()
    this.ctx.beginPath()
    this.ctx.rect(200, 200, 50, 50)
    this.ctx.stroke()
    this.ctx.closePath()
    this.ctx.beginPath()
    if ('circle' in this.ctx) this.ctx.circle(400, 400, 50)
    this.ctx.stroke()
    this.ctx.closePath()
  }
}
