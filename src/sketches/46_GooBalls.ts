import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import { getTangentsToCircle } from '../utils/geomUtils'
import { perlin2, seedNoise } from '../utils/noise'
import { randFloatRange } from '../utils/numberUtils'
import { initPen, penUp, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import Range, { BooleanRange } from './tools/Range'

export default class GooBalls extends Sketch {
  // static generateGCode = false
  static enableCutouts = false

  init() {
    this.addVar('speedUp', {
      initialValue: 50,
      min: 1,
      max: 100,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('seed', {
      initialValue: 1000,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.addVar('gutter', {
      initialValue: 12,
      min: 0,
      max: 25,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('gutter', {
      initialValue: 12,
      min: 0,
      max: 25,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('minRadius', {
      initialValue: 10,
      min: 1,
      max: 50,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('maxRadius', {
      initialValue: 50,
      min: 1,
      max: 100,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('minGap', {
      initialValue: 0,
      min: 1,
      max: 50,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('maxGap', {
      initialValue: 50,
      min: 1,
      max: 100,
      step: 1,
      disableRandomize: true,
    })
  }

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)

    this.planCreature()
  }

  planCreature(): void {
    const { gutter, minRadius, maxRadius, minGap, maxGap } = this.vars
    const radius1 = randFloatRange(minRadius, maxRadius)
    const radius2 = randFloatRange(minRadius, maxRadius)
    const circlePt1 = new Point(
      gutter + radius1 + randFloatRange(this.cw - (gutter + radius1) * 2),
      gutter + radius1 + randFloatRange(this.ch - (gutter + radius1) * 2)
    )
    const pt2angle = randFloatRange(Math.PI * 2)
    const pt2dist = randFloatRange(radius1 + radius2 + maxGap, radius1 + radius2 + minGap)
    const circlePt2 = circlePt1
      .clone()
      .add(new Point(Math.cos(pt2angle) * pt2dist, Math.sin(pt2angle) * pt2dist))

    const gapDist = circlePt1.distanceTo(circlePt2) - (radius1 + radius2)
    const midPt = circlePt1.clone().moveTowards(circlePt2, radius1 + gapDist / 2)

    const tangentPts1 = getTangentsToCircle(midPt, circlePt1, radius1)
    const tangentPts2 = getTangentsToCircle(midPt, circlePt2, radius2)

    // this.ctx.strokeCircle(circlePt1, radius1, { debug: true })
    // this.ctx.strokeCircle(circlePt2, radius2, { debug: true })

    this.ctx.beginPath()
    this.ctx.arc(
      circlePt1.x,
      circlePt1.y,
      radius1,
      circlePt1.angleTo(tangentPts1[0]),
      circlePt1.angleTo(tangentPts1[1]),
      false
    )
    this.ctx.stroke()

    this.ctx.beginPath()
    this.ctx.arc(
      circlePt2.x,
      circlePt2.y,
      radius2,
      circlePt2.angleTo(tangentPts2[0]),
      circlePt2.angleTo(tangentPts2[1]),
      false
    )
    this.ctx.stroke()

    // debugDot(this.ctx, midPt, 'red')
    // debugDot(this.ctx, tangentPts1[0], 'blue')
    // debugDot(this.ctx, tangentPts1[1], 'blue')
    // debugDot(this.ctx, tangentPts2[0], 'green')
    // debugDot(this.ctx, tangentPts2[1], 'green')
    // this.ctx.beginPath()
    // this.ctx.moveTo(...midPt.toArray())
    // this.ctx.lineTo(...tangentPts1[0].toArray())
    // this.ctx.moveTo(...midPt.toArray())
    // this.ctx.lineTo(...tangentPts1[1].toArray())
    // this.ctx.moveTo(...midPt.toArray())
    // this.ctx.lineTo(...tangentPts2[0].toArray())
    // this.ctx.moveTo(...midPt.toArray())
    // this.ctx.lineTo(...tangentPts2[1].toArray())
    // this.ctx.stroke({ debug: true })

    this.ctx.beginPath()
    this.ctx.moveTo(...tangentPts1[0].toArray())
    this.ctx.bezierCurveTo(midPt.x, midPt.y, midPt.x, midPt.y, tangentPts2[1].x, tangentPts2[1].y)
    this.ctx.moveTo(...tangentPts1[1].toArray())
    this.ctx.bezierCurveTo(midPt.x, midPt.y, midPt.x, midPt.y, tangentPts2[0].x, tangentPts2[0].y)
    this.ctx.stroke()
  }

  draw(increment: number): void {
    //
  }
}
