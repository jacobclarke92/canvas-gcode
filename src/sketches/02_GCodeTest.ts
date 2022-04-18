import { Sketch } from '../Sketch'

export default class GCodeTest extends Sketch {
  init() {
    this.ctx.driver.comment('Drawing single line')
    this.ctx.beginPath()
    this.ctx.moveTo(100, 100)
    this.ctx.lineTo(200, 100)
    this.ctx.stroke()
    this.ctx.closePath()

    this.ctx.driver.comment('Drawing joined line')
    this.ctx.beginPath()
    this.ctx.moveTo(200, 400)
    this.ctx.lineTo(250, 400)
    this.ctx.lineTo(300, 450)
    this.ctx.stroke()
    this.ctx.closePath()

    this.ctx.driver.comment('Drawing rect')
    this.ctx.beginPath()
    this.ctx.rect(200, 200, 50, 50)
    this.ctx.stroke()
    this.ctx.closePath()

    this.ctx.driver.comment('Drawing circle')
    this.ctx.beginPath()
    if ('circle' in this.ctx) this.ctx.circle(400, 400, 50)
    this.ctx.stroke()
    this.ctx.closePath()
  }
}
