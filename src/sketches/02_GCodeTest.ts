import { Sketch } from '../Sketch'

export default class GCodeTest extends Sketch {
  init() {
    this.ctx.driver.comment('Drawing single line')

    /*

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

    this.ctx.driver.comment('Drawing arc')
    this.ctx.beginPath()
    this.ctx.arc(70, 50, 5, Math.PI / 2, -Math.PI * 0.75, true)
    this.ctx.stroke()
    this.ctx.closePath()

    this.ctx.driver.comment('Drawing bezier curve')
    this.ctx.beginPath()
    this.ctx.moveTo(10, 60)
    this.ctx.bezierCurveTo(20, 70, 30, 50, 40, 60)
    this.ctx.stroke()
    this.ctx.closePath()

    this.ctx.driver.comment('Drawing quadratic curve')
    this.ctx.beginPath()
    this.ctx.moveTo(50, 30)
    this.ctx.quadraticCurveTo(60, 60, 70, 30)
    this.ctx.stroke()
    this.ctx.closePath()

    */

    this.ctx.driver.comment('Drawing concentric circles')
    for (let i = 0; i < 20; i++) {
      this.ctx.strokeCircle(100, 30, 1 + i)
    }
    this.ctx.clearRect(100, 35, 20, 20)
  }
}
