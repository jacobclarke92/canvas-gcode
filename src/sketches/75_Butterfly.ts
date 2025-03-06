import type GCanvas from '../GCanvas'
import type { IntPoint } from '../packages/Clipper/IntPoint'
import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import { seedNoise } from '../utils/noise'
import { randFloat, randFloatRange } from '../utils/numberUtils'
import { seedRandom } from '../utils/random'
import { generateSpline, generateSplineWithEnds } from '../utils/splineUtils'

class Butterfly {
  ctx: GCanvas
  pt: Point
  scale = 1
  constructor(opts: {
    ctx: GCanvas
    /** Head position */
    pt: Point
    scale?: number
  }) {
    this.ctx = opts.ctx
    this.pt = opts.pt
    if (opts.scale) this.scale = opts.scale
    //
  }

  draw() {
    const headSplinePts = this.ctx.strokeSmoothClosedPath([
      new Point(this.pt.x - 1.5 * this.scale, this.pt.y + 1.7 * this.scale),
      new Point(this.pt.x + 1.5 * this.scale, this.pt.y + 1.7 * this.scale),
      new Point(this.pt.x + 1 * this.scale, this.pt.y - 2 * this.scale),
      new Point(this.pt.x - 1 * this.scale, this.pt.y - 2 * this.scale),
    ])
    const bodySplinePts = this.ctx.strokeSmoothClosedPath([
      new Point(this.pt.x - 1.5 * this.scale, this.pt.y + 2.7 * this.scale),
      new Point(this.pt.x + 1.5 * this.scale, this.pt.y + 2.7 * this.scale),
      new Point(this.pt.x + 1.5 * this.scale, this.pt.y + 9.5 * this.scale),
      new Point(this.pt.x - 1.5 * this.scale, this.pt.y + 9.5 * this.scale),
    ])
    const thoraxSplinePts = this.ctx.strokeSmoothClosedPath([
      new Point(this.pt.x - 1.2 * this.scale, this.pt.y + 12 * this.scale),
      new Point(this.pt.x + 1.2 * this.scale, this.pt.y + 12 * this.scale),
      new Point(this.pt.x + 1.2 * this.scale, this.pt.y + 26 * this.scale),
      new Point(this.pt.x - 1.2 * this.scale, this.pt.y + 26 * this.scale),
    ])
    const bodyStartRight = bodySplinePts[Math.floor(bodySplinePts.length * 0.32)]
    const bodyEndRight = bodySplinePts[Math.floor(bodySplinePts.length * 0.42)]
    const bodyStartLeft = bodySplinePts[Math.floor(bodySplinePts.length * 0.94)]
    const bodyEndLeft = bodySplinePts[Math.floor(bodySplinePts.length * 0.84)]
    const thoraxEndRight = thoraxSplinePts[Math.floor(thoraxSplinePts.length * 0.42)]
    const thoraxEndLeft = thoraxSplinePts[Math.floor(thoraxSplinePts.length * 0.84)]

    debugDot(this.ctx, bodyStartRight)
    debugDot(this.ctx, bodyEndRight)
    debugDot(this.ctx, bodyStartLeft)
    debugDot(this.ctx, bodyEndLeft)
    debugDot(this.ctx, thoraxEndRight)
    debugDot(this.ctx, thoraxEndLeft)

    const bodyStartRightPt = new Point(bodyStartRight.x, bodyStartRight.y)
    const bodyEndRightPt = new Point(bodyEndRight.x, bodyEndRight.y)
    const topWingSplinePts = this.ctx.strokeSmoothPath(
      [
        bodyStartRightPt,
        bodyStartRightPt.clone().add((10 + randFloat(2)) * this.scale, -2 * this.scale),
        bodyStartRightPt.clone().add((40 + randFloat(5)) * this.scale, -5 * this.scale),
        bodyStartRightPt.clone().add((60 + randFloat(5)) * this.scale, 5 * this.scale),
        bodyStartRightPt.clone().add((40 + randFloat(5)) * this.scale, 25 * this.scale),
        bodyEndRightPt,
      ],
      { debug: true }
    )

    const thoraxStartRight = topWingSplinePts[Math.floor(topWingSplinePts.length * 0.8)]
    const thoraxStartRightPt = new Point(thoraxStartRight.x, thoraxStartRight.y)
    const thoraxEndRightPt = new Point(thoraxEndRight.x, thoraxEndRight.y)
    debugDot(this.ctx, thoraxStartRight)

    const bottomWingFarRightPt = thoraxStartRightPt
      .clone()
      .moveAlongAngle(bodyEndRightPt.angleTo(thoraxStartRightPt), 15 * this.scale)
      .add(0, 2 * this.scale)

    let bottomWingPts: (Point | IntPoint)[] = [
      thoraxStartRightPt,
      bottomWingFarRightPt,
      thoraxStartRightPt.clone().add(10 * this.scale, randFloatRange(30, 20) * this.scale),
      thoraxStartRightPt.clone().add(-15 * this.scale, randFloatRange(45, 35) * this.scale),
      thoraxEndRightPt,
    ]

    // const initialBottomWingSplinePts = generateSplineWithEnds(bottomWingPts)
    const initialBottomWingSplinePts = this.ctx.strokeSmoothPath(bottomWingPts, {
      debug: true,
      debugColor: 'yellow',
    })

    const droops = 2
    const droopIndexes: number[] = []
    const indexRangeMin = randFloatRange(0.5, 0.4)
    const indexRangeMax = randFloatRange(0.9, 0.8)
    const indexRange = indexRangeMax - indexRangeMin
    const indexRangeSeg = indexRange / (droops + 1)
    for (let i = 0; i < droops; i++) {
      const index = Math.floor(
        initialBottomWingSplinePts.length * (indexRangeMin + indexRangeSeg / 2 + indexRangeSeg * i)
      )
      droopIndexes.push(index)
    }
    // const droopIndexRange = [
    //   Math.floor(initialBottomWingSplinePts.length * 0.45),
    //   Math.floor(initialBottomWingSplinePts.length * 0.9),
    // ]

    bottomWingPts = [
      ...bottomWingPts.slice(0, 2),
      initialBottomWingSplinePts[Math.floor(initialBottomWingSplinePts.length * indexRangeMin)],
      ...droopIndexes.flatMap((index) => {
        const pt1 = initialBottomWingSplinePts[index - 1]
        const pt2 = initialBottomWingSplinePts[index + 1]
        const adjacentAngle = Math.atan2(pt1.y - pt2.y, pt1.x - pt2.x) + Math.PI / 2
        const droopDist = randFloatRange(25, 15) * this.scale
        return [
          pt1,
          new Point(
            initialBottomWingSplinePts[index].x + Math.cos(adjacentAngle) * droopDist,
            initialBottomWingSplinePts[index].y + Math.sin(adjacentAngle) * droopDist
          ),
          pt2,
        ]
      }),
      initialBottomWingSplinePts[Math.floor(initialBottomWingSplinePts.length * indexRangeMax)],
      ...bottomWingPts.slice(4),
    ]

    const bottomWingSplinePts = this.ctx.strokeSmoothPath(bottomWingPts, { debug: true })

    debugDot(
      this.ctx,
      initialBottomWingSplinePts[Math.floor(initialBottomWingSplinePts.length * indexRangeMin)],
      'blue'
    )
    debugDot(
      this.ctx,
      initialBottomWingSplinePts[Math.floor(initialBottomWingSplinePts.length * indexRangeMax)],
      'blue'
    )
  }
}

export default class Butterfree extends Sketch {
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

    const butterfly1 = new Butterfly({
      ctx: this.ctx,
      pt: this.cp.clone(),
      scale: 1,
    })

    const butterfly2 = new Butterfly({
      ctx: this.ctx,
      pt: this.cp.clone().add(100, 0),
      scale: 0.5,
    })

    butterfly1.draw()
    butterfly2.draw()
  }

  draw(): void {
    //
  }
}
