import { Sketch } from '../Sketch'
import { debugText } from '../utils/debugUtils'
import { initPen, penUp, plotBounds } from '../utils/penUtils'

export default class GCodeTest extends Sketch {
  init() {
    initPen(this)
    plotBounds(this)

    this.ctx.driver.comment('Drawing single line')
    debugText(this.ctx, 'Single line', [10, 10 - 2], { size: 2 })
    this.ctx.beginPath()
    this.ctx.moveTo(10, 10)
    this.ctx.lineTo(20, 10)
    this.ctx.stroke()
    this.ctx.closePath()

    this.ctx.driver.comment('Drawing joined line')
    debugText(this.ctx, 'Joined line', [20, 40 - 2], { size: 2 })
    this.ctx.beginPath()
    this.ctx.moveTo(20, 40)
    this.ctx.lineTo(25, 40)
    this.ctx.lineTo(30, 45)
    this.ctx.stroke()
    this.ctx.closePath()

    this.ctx.driver.comment('Drawing rect outline')
    debugText(this.ctx, 'Rect outline', [20, 20 - 2], { size: 2 })
    this.ctx.strokeRect(20, 20, 5, 5)

    this.ctx.driver.comment('Drawing rect fill')
    debugText(this.ctx, 'Rect fill', [30, 20 - 2], { size: 2 })
    this.ctx.fillRect(30, 20, 5, 5)

    this.ctx.driver.comment('Drawing circle')
    debugText(this.ctx, 'Circle', [40, 40 - 2], { size: 2 })
    this.ctx.beginPath()
    if ('circle' in this.ctx) this.ctx.circle(40, 40, 5)
    this.ctx.stroke()
    this.ctx.closePath()

    this.ctx.driver.comment('Drawing arc')
    debugText(this.ctx, 'Arc', [70, 50 - 2], { size: 2 })
    this.ctx.beginPath()
    this.ctx.arc(70, 50, 5, Math.PI / 2, -Math.PI * 0.75, true)
    this.ctx.stroke()
    this.ctx.closePath()

    this.ctx.driver.comment('Drawing bezier curve')
    debugText(this.ctx, 'Bezier curve', [10, 60 - 2], { size: 2 })
    this.ctx.beginPath()
    this.ctx.moveTo(10, 60)
    this.ctx.bezierCurveTo(20, 70, 30, 50, 40, 60)
    this.ctx.stroke()
    this.ctx.closePath()

    this.ctx.driver.comment('Drawing quadratic curve')
    debugText(this.ctx, 'Quadratic curve', [50, 30 - 2], { size: 2 })
    this.ctx.beginPath()
    this.ctx.moveTo(50, 30)
    this.ctx.quadraticCurveTo(60, 60, 70, 30)
    this.ctx.stroke()
    this.ctx.closePath()

    /*
     */

    this.ctx.driver.comment('Drawing concentric circles')
    debugText(this.ctx, 'Concentric circles', [100, 30 - 20 - 2], { size: 2 })
    for (let i = 0; i < 20; i++) {
      this.ctx.strokeCircle(100, 30, 1 + i)
    }
    // // this.ctx.strokeCircle(100, 30, 20)
    // this.ctx.clearRect(100, 35, 20, 20)
    // this.ctx.clearCircle(100, 15, 8)

    penUp(this)
  }
}
