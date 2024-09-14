import { colors } from '../constants/colors'
import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import { debugDot } from '../utils/debugUtils'
import {
  circleOverlapsCircles,
  getBezierPoint,
  getBezierPoints,
  lerp,
  lineIntersectsWithAny,
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
    this.addVar('gutter', {
      initialValue: 10,
      min: 0,
      max: 70,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('amount', {
      initialValue: 3,
      min: 1,
      max: 80,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('minLength', {
      initialValue: 50,
      min: 10,
      max: 200,
      step: 0.1,
    })
    this.addVar('maxLength', {
      initialValue: 150,
      min: 10,
      max: 200,
      step: 0.1,
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
      max: 0.6,
      step: 0.001,
    })
    this.addVar('strandArcAmount', {
      initialValue: 0.8,
      min: 0,
      max: 1.001,
      step: 0.001,
    })
    this.addVar('strandUplift', {
      initialValue: 0.45,
      min: -1.2,
      max: 1.2,
      step: 0.001,
    })
    this.addVar('strandUprightTrend', {
      initialValue: 0.9,
      min: 0,
      max: 1.001,
      step: 0.001,
    })
    this.addVar('scraggliness', {
      initialValue: 0.008,
      min: 0,
      max: 0.1,
      step: 0.001,
    })
  }

  unresolvedCount = 0
  finished = false
  linesToAvoid: Line[] = []

  initDraw(): void {
    const { seed, gutter, amount, maxLength, spineNodes } = this.vars
    const minLength = Math.min(this.vars.minLength, maxLength - 1)
    seedRandom(seed)
    seedNoise(this.vs.seed.value)
    initPen(this)

    this.unresolvedCount = 0
    this.finished = false
    this.linesToAvoid = []

    if (amount === 1) {
      this.createFeather(
        new Point(this.cw * 0.25, this.ch - gutter),
        new Point(this.cw * 0.75, gutter),
        0
      )
      penUp(this)
    }
  }

  createFeather(startPt: Point, endPt: Point, depth = 0, overrides?: { [key: string]: number }) {
    const opts = { ...this.vars, ...(overrides || {}) }
    const {
      maxSpineBowDeg,
      spineThickness,
      spineNodes,
      stemLengthPercent,
      strandBreadthRatio,
      maxStrandBowDeg,
      strandUplift,
      strandUprightTrend,
      strandArcAmount,
      scraggliness,
    } = opts
    const featherAngle = startPt.angleTo(endPt)
    const dist = startPt.distanceTo(endPt)
    const skew1 = randFloatRange(degToRad(depth === 0 ? maxSpineBowDeg : maxStrandBowDeg))
    const skew2 = randFloatRange(degToRad(depth === 0 ? maxSpineBowDeg : maxStrandBowDeg))
    const flip = randFloatRange(1) > 0.5 ? 1 : -1
    const leftCtrl1 = new Point(
      Math.cos(featherAngle - skew1 * flip) * dist * 0.2,
      Math.sin(featherAngle - skew1 * flip) * dist * 0.2
    ).add(startPt)
    const leftCtrl2 = new Point(
      Math.cos(featherAngle + Math.PI - skew2 * flip) * dist * 0.5,
      Math.sin(featherAngle + Math.PI - skew2 * flip) * dist * 0.5
    ).add(endPt)
    const rightCtrl1 = new Point(
      Math.cos(featherAngle - (skew1 - spineThickness) * flip) * dist * 0.2,
      Math.sin(featherAngle - (skew1 - spineThickness) * flip) * dist * 0.2
    ).add(startPt)
    const rightCtrl2 = new Point(
      Math.cos(featherAngle + Math.PI - (skew2 + spineThickness) * flip) * dist * 0.5,
      Math.sin(featherAngle + Math.PI - (skew2 + spineThickness) * flip) * dist * 0.5
    ).add(endPt)
    // debugDot(this.ctx, leftCtrl1)
    // debugDot(this.ctx, leftCtrl2)

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

        const strandLength = Math.max(
          0,
          dist *
            strandBreadthRatio *
            (1 - strandArcAmount + Math.sin(spineT * Math.PI) * strandArcAmount) +
            randFloat(scraggliness * dist)
        )

        const leftOuterPtPerpAngle = leftAngle - (Math.PI / 2 - strandUplift) * flip
        const rightOuterPtPerpAngle = rightAngle + (Math.PI / 2 - strandUplift) * flip

        const leftOuterPtAngle = lerp(leftOuterPtPerpAngle, leftAngle, spineT * strandUprightTrend)
        const rightOuterPtAngle = lerp(
          rightOuterPtPerpAngle,
          rightAngle,
          spineT * strandUprightTrend
        )

        const leftOuterPt = new Point(
          Math.cos(leftOuterPtAngle) * strandLength,
          Math.sin(leftOuterPtAngle) * strandLength
        ).add(leftPt)
        const rightOuterPt = new Point(
          Math.cos(rightOuterPtAngle) * strandLength,
          Math.sin(rightOuterPtAngle) * strandLength
        ).add(rightPt)

        // optimization - alternate drawing strands from left to right
        if (i % 2 === 0) {
          this.createFeather(leftOuterPt, leftPt, depth + 1)
          this.createFeather(rightPt, rightOuterPt, depth + 1)
        } else {
          this.createFeather(rightOuterPt, rightPt, depth + 1)
          this.createFeather(leftPt, leftOuterPt, depth + 1)
        }
      }
    }
  }

  draw(increment: number): void {
    const { amount, gutter, minLength: _minLength, maxLength, spineNodes } = this.vars
    const minLength = _minLength > maxLength ? maxLength - 1 : _minLength

    if (amount === 1) return

    if (this.linesToAvoid.length >= amount || this.unresolvedCount >= 12) {
      if (!this.finished) {
        penUp(this)
        this.finished = true
      }
      return
    }

    // const lines: Line[] = []
    let panik = 0
    while (panik < 500) {
      const start = new Point(
        randFloatRange(this.cw - gutter, gutter),
        randFloatRange(this.ch - gutter, gutter)
      )
      const end = new Point(
        randFloatRange(this.cw - gutter, gutter),
        randFloatRange(this.ch - gutter, gutter)
      )
      const angle = start.angleTo(end)
      const line: Line = [
        start.clone().moveAlongAngle(angle + Math.PI, maxLength * 0.35),
        end.clone().moveAlongAngle(angle, maxLength * 0.35),
      ]
      // this.ctx.strokeLine(...line)
      const length = start.distanceTo(end)
      if (length > maxLength || length < minLength) {
        panik++
        continue
      }
      if (this.linesToAvoid.length > 0 && lineIntersectsWithAny(line, ...this.linesToAvoid)) {
        panik++
        continue
      }

      this.createFeather(start, end, 0, {
        spineNodes: Math.ceil(spineNodes * Math.min(1, length / maxLength)),
      })

      this.linesToAvoid.push(line)
      break
    }
    if (panik >= 500) this.unresolvedCount++
  }
}
