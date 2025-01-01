import { colors } from '../constants/colors'
import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import { debugDot } from '../utils/debugUtils'
import { isInBounds, lineIntersectsWithAny } from '../utils/geomUtils'
import { radToDeg, randFloatRange, randIntRange } from '../utils/numberUtils'
import { initPen, penUp, plotBounds, stopAndWigglePen } from '../utils/penUtils'
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
    this.addVar('gutter', { disableRandomize: true, initialValue: 5, min: 0, max: 100, step: 0.1 })
    this.addVar('maxTendrils', { initialValue: 100, min: 1, max: 1000, step: 1 })
    this.addVar('angleVariance', { initialValue: Math.PI * 0.7, min: 0, max: Math.PI, step: 0.1 })
    this.addVar('maxPlacementAttempts', { initialValue: 256, min: 1, max: 1000, step: 1 })
    this.addVar('preventOverlapsAfter', {
      disableRandomize: true,
      initialValue: 3,
      min: 1,
      max: 24,
      step: 1,
    })
    // this.addVar('minSegLength', { initialValue: 2, min: 1, max: 24, step: 1 })
    this.addVar('maxSegLength', { initialValue: 14, min: 1, max: 24, step: 1 })
  }

  tendrils: Point[][] = []
  tendrilLines: Line[][] = []
  lastAngle = 0
  placementAttempts = 0

  initDraw(): void {
    seedRandom(this.vars.seed)
    initPen(this)
    plotBounds(this)
    // Challenge: Vertical or horizontal lines only.
    // thinking...

    // idea 1: city roads from above branching out from a central point
    // idea 2: a cityscape with backdrop of sunset and blocky clouds

    this.tendrils = [[this.cp.clone()]]
    this.tendrilLines = []
    this.lastAngle = 0
    this.placementAttempts = 0
  }

  getAverageAngle(tendril: Point[]): number {
    const pt = new Point()
    tendril.forEach((p) => pt.add(p.x - this.cx, p.y - this.cy))
    return Math.atan2(pt.y, pt.x)
  }

  draw(increment: number): void {
    const {
      gutter,
      maxTendrils,
      angleVariance,
      maxPlacementAttempts,
      minSegLength,
      maxSegLength,
      preventOverlapsAfter,
    } = this.vars
    if (this.tendrils.length > maxTendrils) return
    const tendril = this.tendrils[this.tendrils.length - 1]
    const averageAngle =
      tendril.length < 2 ? randFloatRange(Math.PI, -Math.PI) : this.getAverageAngle(tendril)
    const aimAngle = averageAngle + randFloatRange(angleVariance, -angleVariance)
    // snap to 90 degree angles
    let angle = (Math.round(aimAngle / (Math.PI / 2)) * (Math.PI / 2)) % (Math.PI * 2)
    if (angle === this.lastAngle) {
      angle = (angle + randFloatRange(1) > 0.5 ? Math.PI / 2 : -Math.PI / 2) % (Math.PI * 2)
    }
    this.lastAngle = angle

    const dist = randIntRange(maxSegLength, 1 /*minSegLength*/)

    const prevPt = tendril[tendril.length - 1]
    const nextPt = prevPt.clone().moveAlongAngle(angle, dist)
    if (
      !isInBounds(nextPt, [0, this.cw, this.ch, 0], gutter) ||
      this.placementAttempts > maxPlacementAttempts
    ) {
      this.tendrilLines.push(tendrilToLines(tendril))
      this.tendrils.push([this.cp.clone()])
      this.placementAttempts = 0
      return
    }

    let overlaps = false
    for (const tendrilLines of this.tendrilLines) {
      if (lineIntersectsWithAny([prevPt, nextPt], ...tendrilLines.slice(preventOverlapsAfter))) {
        overlaps = true
        break
      }
    }
    if (overlaps) {
      this.placementAttempts++
    } else {
      tendril.push(nextPt)
      this.ctx.beginPath()
      this.ctx.moveTo(prevPt.x, prevPt.y)
      this.ctx.lineTo(nextPt.x, nextPt.y)
      this.ctx.stroke()
    }
  }
}
