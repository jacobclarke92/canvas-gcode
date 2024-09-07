import { colors } from '../constants/colors'
import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import {
  circleOverlapsCircles,
  getBezierPoint,
  getBezierPoints,
  pointInCircles,
} from '../utils/geomUtils'
import { seedNoise } from '../utils/noise'
import { degToRad, randFloatRange } from '../utils/numberUtils'
import { initPen, penUp, plotBounds, stopAndWigglePen } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

export default class BoaF extends Sketch {
  static generateGCode = true
  static disableOverclock = true

  init() {
    this.addVar('seed', {
      initialValue: 1234,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.addVar('speedUp', {
      initialValue: 10,
      min: 1,
      max: 200,
      step: 1,
    })
    this.addVar('maxBowDeg', {
      initialValue: 15,
      min: 0,
      max: 90,
      step: 0.1,
    })
    this.addVar('spineNodes', {
      initialValue: 50,
      min: 4,
      max: 200,
      step: 1,
    })
    this.addVar('stemLengthPercent', {
      initialValue: 0.2,
      min: 0,
      max: 0.95,
      step: 0.001,
    })
    this.addVar('strandBreadthRatio', {
      initialValue: 0.2,
      min: 0,
      max: 0.95,
      step: 0.001,
    })
  }

  initDraw(): void {
    const { seed, numBoids, gutter } = this.vars
    seedRandom(seed)
    seedNoise(this.vs.seed.value)

    this.createFeather(
      new Point(this.cw * 0.35, this.ch * 0.8),
      new Point(this.cw * 0.6, this.ch * 0.2)
    )
  }

  createFeather(startPt: Point, endPt: Point, depth = 0) {
    const { maxBowDeg, spineNodes, stemLengthPercent, strandBreadthRatio } = this.vars
    const angle = startPt.angleTo(endPt)
    const dist = startPt.distanceTo(endPt)
    const skew1 = randFloatRange(degToRad(maxBowDeg))
    const skew2 = randFloatRange(degToRad(maxBowDeg))
    const ctrl1 = new Point(
      Math.cos(angle - skew1) * dist * 0.2,
      Math.sin(angle - skew1) * dist * 0.2
    ).add(startPt)
    const ctrl2 = new Point(
      Math.cos(angle + Math.PI - skew2) * dist * 0.5,
      Math.sin(angle + Math.PI - skew2) * dist * 0.5
    ).add(endPt)
    // debugDot(this.ctx, ctrl1)
    // debugDot(this.ctx, ctrl2)

    this.ctx.beginPath()
    // this.ctx.moveTo(startPt.x, startPt.y)
    // this.ctx.lineTo(endPt.x, endPt.y)
    // this.ctx.stroke()
    this.ctx.moveTo(startPt.x, startPt.y)
    this.ctx.bezierCurveTo(ctrl1.x, ctrl1.y, ctrl2.x, ctrl2.y, endPt.x, endPt.y)
    this.ctx.stroke()

    if (depth === 0) {
      const bezierPts = getBezierPoints(startPt, ctrl1, ctrl2, endPt, spineNodes)
      const spineStartIdx = Math.floor(spineNodes * stemLengthPercent)
      for (let i = 1; i < bezierPts.length; i++) {
        if (i < spineStartIdx) continue
        const spineT = (i - spineStartIdx) / (spineNodes - spineStartIdx)
        const pt = bezierPts[i]
        const prevPt = bezierPts[i - 1]
        const angle = prevPt.angleTo(pt)
        // debugDot(this.ctx, pt)

        const strandLength = dist * strandBreadthRatio * Math.sin(spineT * Math.PI)
        this.createFeather(
          pt,
          new Point(
            Math.cos(angle - Math.PI / 2) * strandLength,
            Math.sin(angle - Math.PI / 2) * strandLength
          ).add(pt),
          depth + 1
        )
        this.createFeather(
          pt,
          new Point(
            Math.cos(angle + Math.PI / 2) * strandLength,
            Math.sin(angle + Math.PI / 2) * strandLength
          ).add(pt),
          depth + 1
        )
      }
    }
  }

  draw(increment: number): void {
    //
  }
}
