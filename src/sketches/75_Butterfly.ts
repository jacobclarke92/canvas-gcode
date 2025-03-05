import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import { seedNoise } from '../utils/noise'
import { seedRandom } from '../utils/random'
import { generateSpline } from '../utils/splineUtils'

export default class Butterfly extends Sketch {
  // static generateGCode = false
  static enableCutouts = false

  init() {
    this.addVar('seed',{ name: 'seed', initialValue: 1010, min: 1000, max: 5000, step: 1 }) // prettier-ignore
    this.addVar('dist', { name: 'dist', initialValue: 80, min: 0, max: 200, step: 0.5 })
  }

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)

    // const points: Point[] = []
    // for (let i = 0; i < 10; i++) {
    //   points.push(new Point(randFloatRange(this.cw, 0), randFloatRange(this.ch, 0)))
    // }

    const pointsTop = [
      new Point(40, 75),
      new Point(50, 75),
      new Point(100, 50),
      new Point(120, 70),
      new Point(110, 72),
      new Point(108, 95),
      new Point(106, 95),
      new Point(105, 75),
      new Point(90, 90),
      new Point(75, 100), // use this as starting point for next one
      new Point(50, 85),
      new Point(40, 85),
    ]

    const pointsBottom = [
      new Point(50, 85),
      new Point(75, 100),
      new Point(100, 140),
      new Point(90, 160),
      new Point(65, 180),

      new Point(50, 100),
      new Point(40, 100),
    ]

    for (const point of pointsTop) debugDot(this.ctx, point)
    for (const point of pointsBottom) debugDot(this.ctx, point)

    const splinePtsTop = generateSpline(pointsTop, 12)
    this.ctx.beginPath()
    for (let i = 0; i < splinePtsTop.length; i++) {
      const pt = splinePtsTop[i]
      if (i === 0) this.ctx.moveTo(pt.x, pt.y)
      else this.ctx.lineTo(pt.x, pt.y)
    }
    this.ctx.stroke()

    const splinePtsBottom = generateSpline(pointsBottom, 12)
    this.ctx.beginPath()
    for (let i = 0; i < splinePtsBottom.length; i++) {
      const pt = splinePtsBottom[i]
      if (i === 0) this.ctx.moveTo(pt.x, pt.y)
      else this.ctx.lineTo(pt.x, pt.y)
    }
    this.ctx.stroke()
  }

  draw(): void {
    //
  }
}
