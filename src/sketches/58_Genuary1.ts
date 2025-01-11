import { clamp } from 'lodash'

import { deg90, deg360 } from '../constants/angles'
import { colors } from '../constants/colors'
import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import type { RGB } from '../utils/colorUtils'
import { hexToRgb, rgbToHex } from '../utils/colorUtils'
import type { Bounds } from '../utils/geomUtils'
import { isInBounds, lineIntersectsWithAny } from '../utils/geomUtils'
import { randFloatRange, randIntRange } from '../utils/numberUtils'
import { initPen, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

const tendrilToLines = (tendril: Point[]): Line[] => {
  const lines: Line[] = []
  for (let i = 0; i < tendril.length - 1; i++) {
    lines.push([tendril[i], tendril[i + 1]])
  }
  return lines
}

export default class Genuary1 extends Sketch {
  init() {
    this.addVar('seed', { initialValue: 3994, min: 1000, max: 5000, step: 1 })
    this.addVar('speedUp', { initialValue: 32, min: 1, max: 50, step: 1 })
    this.addVar('gutter', { disableRandomize: true, initialValue: 3, min: 0, max: 100, step: 0.1 })
    // this.addVar('minSegLength', { initialValue: 2, min: 1, max: 24, step: 1 })
    this.addVar('maxSegLength', { initialValue: 8, min: 1, max: 24, step: 1 })
    this.addVar('maxTendrils', { initialValue: 160, min: 1, max: 1000, step: 1 })
    this.addVar('angleVariance', { initialValue: 1.4, min: 0, max: Math.PI, step: 0.1 })
    this.addVar('maxPlacementAttempts', { initialValue: 128, min: 1, max: 1000, step: 1 })
    this.addVar('preventOverlapsAfter', {
      disableRandomize: true,
      initialValue: 8,
      min: 1,
      max: 24,
      step: 1,
    })
    this.vs.preventSelfIntersection = new BooleanRange({
      disableRandomize: true,
      initialValue: true,
    })
    this.vs.debugColors = new BooleanRange({ disableRandomize: true, initialValue: false })
    this.vs.drawFour = new BooleanRange({ disableRandomize: true, initialValue: true })
  }

  tendrils: Point[][] = []
  tendrilLines: Line[][] = []
  lastAngle = 0
  placementAttempts = 0
  currentBounds: Bounds = [0, 0, 0, 0]
  centerPoint = new Point()
  drawCount = 0

  initDraw(): void {
    seedRandom(this.vars.seed)
    initPen(this)
    plotBounds(this)
    // Challenge: Vertical or horizontal lines only.
    // thinking...

    // idea 1: city roads from above branching out from a central point
    // idea 2: a cityscape with backdrop of sunset and blocky clouds

    this.ctx.strokeStyle = '#000'
    this.drawCount = 0
    this.resetDraw()
  }

  resetDraw(): void {
    const { gutter } = this.vars
    this.currentBounds = [0, this.cw, this.ch, 0]
    this.centerPoint = this.cp.clone()
    if (this.vs.drawFour.value) {
      const qw = (this.cw - gutter * 3) / 2
      const qh = (this.ch - gutter * 3) / 2
      if (this.drawCount === 0) {
        this.currentBounds = [0, this.cw / 2, this.ch / 2, 0]
        this.centerPoint = new Point(gutter + qw / 2, gutter + qh / 2)
      } else if (this.drawCount === 1) {
        this.currentBounds = [0, this.cw, this.ch / 2, this.cw / 2]
        this.centerPoint = new Point(gutter * 2 + qw + qw / 2, gutter + qh / 2)
      } else if (this.drawCount === 2) {
        this.currentBounds = [this.ch / 2, this.cw / 2, this.ch, 0]
        this.centerPoint = new Point(gutter + qw / 2, gutter * 2 + qh + qh / 2)
      } else if (this.drawCount === 3) {
        this.currentBounds = [this.ch / 2, this.cw, this.ch, this.cw / 2]
        this.centerPoint = new Point(gutter * 2 + qw + qw / 2, gutter * 2 + qh + qh / 2)
      }
    }

    this.tendrils = [[this.centerPoint.clone()]]
    this.tendrilLines = []
    this.lastAngle = 0
    this.placementAttempts = 0
  }

  getAverageAngle(tendril: Point[]): number {
    const pt = new Point()
    tendril.forEach((p) => pt.add(p.x - this.centerPoint.x, p.y - this.centerPoint.y))
    return Math.atan2(pt.y, pt.x)
  }

  draw(increment: number): void {
    const {
      speedUp,
      gutter,
      maxTendrils,
      angleVariance,
      maxPlacementAttempts,
      maxSegLength,
      preventOverlapsAfter,
    } = this.vars

    for (let i = 0; i < speedUp; i++) {
      if (this.tendrils.length > maxTendrils) {
        if (this.vs.drawFour.value && this.drawCount < 3) {
          this.drawCount++
          this.resetDraw()
        }
        return
      }

      const tendril = this.tendrils[this.tendrils.length - 1]

      const averageAngle =
        tendril.length < 2 ? randFloatRange(Math.PI, -Math.PI) : this.getAverageAngle(tendril)
      const aimAngle = averageAngle + randFloatRange(angleVariance, -angleVariance)
      // snap to 90 degree angles
      let angle = (Math.round(aimAngle / deg90) * deg90) % deg360
      // prevent backtracking
      if (angle === this.lastAngle)
        angle = (angle + randFloatRange(1) > 0.5 ? deg90 : -deg90) % deg360
      this.lastAngle = angle

      const dist = randIntRange(maxSegLength, 1 /*minSegLength*/)

      const prevPt = tendril[tendril.length - 1]
      const nextPt = prevPt.clone().moveAlongAngle(angle, dist)
      if (
        !isInBounds(nextPt, this.currentBounds, gutter) ||
        this.placementAttempts > maxPlacementAttempts
      ) {
        this.tendrilLines.push(tendrilToLines(tendril))
        this.tendrils.push([this.centerPoint.clone()])
        this.placementAttempts = 0
        return
      }

      const selfLines = tendrilToLines(tendril.slice(0, tendril.length - 2))
      if (
        !!this.vs.preventSelfIntersection.value &&
        selfLines.length > 0 &&
        lineIntersectsWithAny([prevPt, nextPt], ...selfLines)
      ) {
        this.placementAttempts++
        return
      } else {
        for (const tendrilLines of this.tendrilLines) {
          if (
            lineIntersectsWithAny([prevPt, nextPt], ...tendrilLines.slice(preventOverlapsAfter))
          ) {
            this.placementAttempts++
            return
          }
        }
      }

      // no overlaps:
      tendril.push(nextPt)
      if (!!this.vs.debugColors.value) {
        const color = hexToRgb(colors[this.tendrils.length % colors.length]).map((c) =>
          clamp(c + Math.round(Math.sin(tendril.length / 5) * 90), 0, 255)
        )
        this.ctx.strokeStyle = rgbToHex(color as RGB)
      }
      this.ctx.beginPath()
      this.ctx.moveTo(prevPt.x, prevPt.y)
      this.ctx.lineTo(nextPt.x, nextPt.y)
      this.ctx.stroke()
    }
  }
}
