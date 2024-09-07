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
import { degToRad, randFloat, randFloatRange } from '../utils/numberUtils'
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
    this.addVar('maxSpineBowDeg', {
      initialValue: 15,
      min: 0,
      max: 180,
      step: 0.1,
    })
    this.addVar('spineThickness', {
      initialValue: 0.05,
      min: 0,
      max: 0.5,
      step: 0.001,
    })
    this.addVar('spineNodes', {
      initialValue: 180,
      min: 4,
      max: 250,
      step: 1,
    })
    this.addVar('stemLengthPercent', {
      initialValue: 0.3,
      min: 0,
      max: 0.95,
      step: 0.001,
    })
    this.addVar('maxStrandBowDeg', {
      initialValue: 15,
      min: 0,
      max: 90,
      step: 0.1,
    })
    this.addVar('strandBreadthRatio', {
      initialValue: 0.13,
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
    const {
      maxSpineBowDeg,
      spineThickness,
      spineNodes,
      stemLengthPercent,
      strandBreadthRatio,
      maxStrandBowDeg,
    } = this.vars
    const angle = startPt.angleTo(endPt)
    const dist = startPt.distanceTo(endPt)
    const skew1 = randFloatRange(degToRad(depth === 0 ? maxSpineBowDeg : maxStrandBowDeg))
    const skew2 = randFloatRange(degToRad(depth === 0 ? maxSpineBowDeg : maxStrandBowDeg))
    const flip = randFloatRange(1) > 0.5 ? 1 : -1
    const leftCtrl1 = new Point(
      Math.cos(angle - skew1 * flip) * dist * 0.2,
      Math.sin(angle - skew1 * flip) * dist * 0.2
    ).add(startPt)
    const leftCtrl2 = new Point(
      Math.cos(angle + Math.PI - skew2 * flip) * dist * 0.5,
      Math.sin(angle + Math.PI - skew2 * flip) * dist * 0.5
    ).add(endPt)
    const rightCtrl1 = new Point(
      Math.cos(angle - (skew1 - spineThickness) * flip) * dist * 0.2,
      Math.sin(angle - (skew1 - spineThickness) * flip) * dist * 0.2
    ).add(startPt)
    const rightCtrl2 = new Point(
      Math.cos(angle + Math.PI - (skew2 + spineThickness) * flip) * dist * 0.5,
      Math.sin(angle + Math.PI - (skew2 + spineThickness) * flip) * dist * 0.5
    ).add(endPt)
    // debugDot(this.ctx, ctrl1)
    // debugDot(this.ctx, ctrl2)

    this.ctx.beginPath()
    // this.ctx.moveTo(startPt.x, startPt.y)
    // this.ctx.lineTo(endPt.x, endPt.y)
    // this.ctx.stroke()
    this.ctx.moveTo(startPt.x, startPt.y)
    this.ctx.bezierCurveTo(leftCtrl1.x, leftCtrl1.y, leftCtrl2.x, leftCtrl2.y, endPt.x, endPt.y)
    this.ctx.stroke()
    if (depth === 0) {
      this.ctx.moveTo(startPt.x, startPt.y)
      this.ctx.bezierCurveTo(
        rightCtrl1.x,
        rightCtrl1.y,
        rightCtrl2.x,
        rightCtrl2.y,
        endPt.x,
        endPt.y
      )
      this.ctx.stroke()
    }

    if (depth === 0) {
      const leftBezierPts = getBezierPoints(startPt, leftCtrl1, leftCtrl2, endPt, spineNodes)
      const rightBezierPts = getBezierPoints(startPt, rightCtrl1, rightCtrl2, endPt, spineNodes)
      const spineStartIdx = Math.floor(spineNodes * stemLengthPercent)
      for (let i = 1; i < leftBezierPts.length; i++) {
        if (i < spineStartIdx) continue
        const spineT = (i - spineStartIdx) / (spineNodes - spineStartIdx)
        const leftPt = leftBezierPts[i]
        const leftPrevPt = leftBezierPts[i - 1]
        const leftAngle = leftPrevPt.angleTo(leftPt)
        const rightPt = rightBezierPts[i]
        const rightPrevPt = rightBezierPts[i - 1]
        const rightAngle = rightPrevPt.angleTo(rightPt)
        // debugDot(this.ctx, pt)

        const strandLength = dist * strandBreadthRatio * Math.sin(spineT * Math.PI)
        this.createFeather(
          leftPt,
          new Point(
            Math.cos(leftAngle - (Math.PI / 2) * flip) * strandLength,
            Math.sin(leftAngle - (Math.PI / 2) * flip) * strandLength
          ).add(leftPt),
          depth + 1
        )
        this.createFeather(
          rightPt,
          new Point(
            Math.cos(rightAngle + (Math.PI / 2) * flip) * strandLength,
            Math.sin(rightAngle + (Math.PI / 2) * flip) * strandLength
          ).add(rightPt),
          depth + 1
        )
      }
    }
  }

  draw(increment: number): void {
    //
  }
}
