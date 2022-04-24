import { Sketch } from '../Sketch'

export default class GCodeTest extends Sketch {
  init() {
    this.ctx.driver.comment('Drawing single line')

    this.ctx.beginPath()
    this.ctx.moveTo(10, 10)
    this.ctx.lineTo(20, 10)
    this.ctx.stroke()
    this.ctx.closePath()

    this.ctx.driver.comment('Drawing joined line')
    this.ctx.beginPath()
    this.ctx.moveTo(20, 40)
    this.ctx.lineTo(25, 40)
    this.ctx.lineTo(30, 45)
    this.ctx.stroke()
    this.ctx.closePath()

    this.ctx.driver.comment('Drawing rect outline')
    this.ctx.strokeRect(20, 20, 5, 5)

    this.ctx.driver.comment('Drawing rect fill')
    this.ctx.fillRect(30, 20, 5, 5)

    this.ctx.driver.comment('Drawing circle')
    this.ctx.beginPath()
    if ('circle' in this.ctx) this.ctx.circle(40, 40, 5)
    this.ctx.stroke()
    this.ctx.closePath()
  }
}
