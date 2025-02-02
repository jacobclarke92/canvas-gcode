import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot, debugText } from '../utils/debugUtils'
import { getContinuousBezierApproximation } from '../utils/geomUtils'
import { randIntRange } from '../utils/numberUtils'
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
    this.ctx.endPath()

    this.ctx.driver.comment('Drawing joined line')
    debugText(this.ctx, 'Joined line', [20, 40 - 2], { size: 2 })
    this.ctx.beginPath()
    this.ctx.moveTo(20, 40)
    this.ctx.lineTo(25, 40)
    this.ctx.lineTo(30, 45)
    this.ctx.stroke()
    this.ctx.endPath()

    this.ctx.driver.comment('Drawing rect outline')
    debugText(this.ctx, 'Rect outline', [20, 20 - 2], { size: 2 })
    this.ctx.strokeRect(20, 20, 5, 5)

    /*
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
    this.ctx.arc(70, 50, 5, Math.PI / 2, -deg135, true)
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


    this.ctx.driver.comment('Drawing concentric circles')
    debugText(this.ctx, 'Concentric circles', [100, 30 - 20 - 2], { size: 2 })
    for (let i = 0; i < 20; i++) {
      this.ctx.strokeCircle(100, 30, 1 + i)
    }

    this.ctx.driver.comment('Drawing offset polygon')
    debugText(this.ctx, 'Offset polygon', [100, 60 - 2], { size: 2 })
    this.ctx.beginPath()
    this.ctx.moveTo(100, 70)
    for (let i = 0; i < 5; i++) {
      this.ctx.lineTo(
        100 + 10 * Math.cos((i * 2 * Math.PI) / 5),
        70 + 10 * Math.sin((i * 2 * Math.PI) / 5)
      )
    }
    this.ctx.closePath()
    this.ctx.stroke()
    for (let i = 0; i < 5; i++) {
      this.ctx.strokeOffsetPath(-1)
    }
      */

    this.ctx.beginPath()
    this.ctx.polygon(120, 80, 3, 2, 0)
    this.ctx.stroke({ cutout: true })
    this.ctx.endPath()

    // // this.ctx.strokeCircle(100, 30, 20)
    // this.ctx.clearRect(100, 35, 20, 20)
    // this.ctx.clearCircle(100, 15, 8)

    // const testPts: Point[] = []
    // for (let i = 0; i < 30; i++) {
    //   testPts.push(new Point(randIntRange(this.cw), randIntRange(this.ch)))
    // }
    // testPts.forEach((pt) => debugDot(this.ctx, pt, 'red'))
    // const bezierPts = getContinuousBezierApproximation(testPts, 30 * 10)
    // this.ctx.beginPath()
    // this.ctx.moveTo(...bezierPts[0].toArray())
    // for (const pt of bezierPts) {
    //   this.ctx.lineTo(...pt.toArray())
    // }
    // this.ctx.stroke()
    // this.ctx.closePath()

    penUp(this)
  }
}
