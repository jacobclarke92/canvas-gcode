import { ClipType, PolyFillType } from 'js-angusj-clipper/web'

import { deg360 } from '../constants/angles'
import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import { getBezierPoints } from '../utils/geomUtils'
import { randFloatRange, randIntRange } from '../utils/numberUtils'
import { initPen, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

function makeKey(a: number, b: number): string {
  // Always store smaller index first
  const [min, max] = [Math.min(a, b), Math.max(a, b)]
  return `${min}-${max}`
}

const getTotalLinesFromPts = (pts: number) => {
  let lines = 0
  for (let i = 1; i < pts + 1; i++) lines += pts - i
  return lines
}

const shortestDistance = (index1: number, index2: number, totalPoints: number): number => {
  // Ensure index1 is always the smaller one for simplicity
  const minIndex = Math.min(index1, index2)
  const maxIndex = Math.max(index1, index2)

  // Compute the two possible distances
  const directDistance = maxIndex - minIndex
  const wrapAroundDistance = totalPoints - directDistance

  // Return the shortest distance, including endpoints
  return Math.min(directDistance, wrapAroundDistance) + 1
}

class Mandala {
  sketch: Sketch
  debug = false

  points = 9
  radius = 25

  totalLines = 0
  done = false
  segAng = 0
  drawnLines: Set<string>
  currentRadialIndex = 0
  currentTestIndex = 0

  cPt: Point

  hasDrawn = (i1: number, i2: number) => this.drawnLines.has(makeKey(i1, i2))

  constructor({
    center,
    points,
    radius,
    sketch,
    debug,
  }: {
    center: Point
    points: number
    radius: number
    sketch: Sketch
    debug?: boolean
  }) {
    this.sketch = sketch
    this.debug = debug
    this.cPt = center
    this.points = points

    this.totalLines = getTotalLinesFromPts(points)

    this.done = false
    this.currentRadialIndex = 0
    this.currentTestIndex = 0
    this.segAng = deg360 / points
    this.radius = radius
    this.drawnLines = new Set()

    if (debug) {
      for (let i = 0; i < points; i++) {
        debugDot(
          sketch.ctx,
          center.x + Math.cos(this.segAng * i) * this.radius,
          center.y + Math.sin(this.segAng * i) * this.radius
        )
      }
    }
  }

  draw() {
    const { avoidUntil, curveDistance, curveLean } = this.sketch.vars

    if (this.done) return

    if (this.drawnLines.size === this.totalLines) {
      this.done = true
      console.log('done!')
      return
    }

    const indexDiff = shortestDistance(this.currentRadialIndex, this.currentTestIndex, this.points)

    const lineAlreadyDrawn = this.hasDrawn(this.currentRadialIndex, this.currentTestIndex)
    const needToAvoid = avoidUntil > 0 && indexDiff <= avoidUntil

    if (needToAvoid && this.currentRadialIndex !== this.currentTestIndex) {
      this.drawnLines.add(makeKey(this.currentRadialIndex, this.currentTestIndex))
    }

    if (lineAlreadyDrawn || needToAvoid || this.currentRadialIndex === this.currentTestIndex) {
      this.currentTestIndex++
      if (this.currentTestIndex >= this.points) {
        this.currentTestIndex = 0
        this.currentRadialIndex++
        if (this.currentRadialIndex >= this.points) this.currentRadialIndex = 0
      }
      this.draw()
      return
    }

    const startAng = this.segAng * this.currentRadialIndex
    const endAng = this.segAng * this.currentTestIndex

    const startPt = new Point(
      this.cPt.x + Math.cos(startAng) * this.radius,
      this.cPt.y + Math.sin(startAng) * this.radius
    )
    const endPt = new Point(
      this.cPt.x + Math.cos(endAng) * this.radius,
      this.cPt.y + Math.sin(endAng) * this.radius
    )

    this.sketch.ctx.beginPath()
    this.sketch.ctx.moveTo(...startPt.toArray())
    if (curveDistance === 0) {
      this.sketch.ctx.lineTo(...endPt.toArray())
    } else {
      const midPt = new Point((startPt.x + endPt.x) / 2, (startPt.y + endPt.y) / 2)
      const midPtDist = midPt.distanceTo(this.cPt)
      const proximityToCenterPercent = midPtDist / this.radius
      if (midPt.distanceTo(new Point(this.cPt.x, this.cPt.y)) > 0.01) {
        const midPtAngle = Math.atan2(midPt.y - this.cPt.y, midPt.x - this.cPt.x)
        midPt.moveAlongAngle(midPtAngle, curveDistance * (proximityToCenterPercent * curveLean))
      }
      this.sketch.ctx.quadraticCurveTo(...midPt.toArray(), ...endPt.toArray())
    }
    this.sketch.ctx.stroke()

    this.drawnLines.add(makeKey(this.currentRadialIndex, this.currentTestIndex))
    this.currentRadialIndex = this.currentTestIndex
    this.currentTestIndex = 0
  }
}

export default class MandalaSpiral extends Sketch {
  // static disableOverclock = true

  init() {
    this.addVar('seed', { initialValue: 3994, min: 1000, max: 5000, step: 1 })
    this.addVar('gutter', { initialValue: 2.5, min: 0, max: 10, step: 0.1 })
    this.addVar('speedUp', { initialValue: 0, min: 1, max: 50, step: 1 })
    this.addVar('offsetX', { initialValue: 0, min: -100, max: 100, step: 1 })
    this.addVar('offsetY', { initialValue: 0, min: -100, max: 100, step: 1 })
    this.addVar('offsetAngle', {
      initialValue: -Math.PI / 4,
      min: -Math.PI,
      max: Math.PI,
      step: 0.001,
    })
    this.addVar('iterations', { initialValue: 9, min: 5, max: 128, step: 1 })
    this.addVar('radiusGrowRate', { initialValue: 2.2, min: 0.1, max: 10, step: 0.1 })
    this.addVar('radiusGrowScale', { initialValue: 1, min: 0.8, max: 1.2, step: 0.001 })
    this.addVar('radianGrowRate', { initialValue: 0.5, min: 0.1, max: 10, step: 0.1 })
    this.addVar('pointsMin', { initialValue: 5, min: 5, max: 128, step: 1 })
    this.addVar('pointsIncrement', { initialValue: 1, min: 1, max: 32, step: 1 })
    this.addVar('avoidUntil', { initialValue: 0, min: 0, max: 32, step: 1 })
    this.addVar('curveDistance', { initialValue: 0.01, min: -100, max: 100, step: 0.1 })
    this.addVar('curveLean', { initialValue: 1, min: -1, max: 3, step: 0.01 })
    this.vs.debug = new BooleanRange({ disableRandomize: true, initialValue: false })
    this.vs.trimToGutter = new BooleanRange({ disableRandomize: true, initialValue: true })
  }

  done = false
  mandalas: Mandala[] = []
  currentMandalaIndex = 0

  initDraw(): void {
    seedRandom(this.vars.seed)
    initPen(this)
    plotBounds(this)

    this.done = false
    this.mandalas = []
    this.currentMandalaIndex = 0

    const {
      iterations,
      pointsMin,
      pointsIncrement,
      offsetAngle,
      radiusGrowRate,
      radiusGrowScale,
      radianGrowRate,
      offsetX,
      offsetY,
    } = this.vars
    const debug = !!this.vs.debug.value

    const pt = this.cp.clone()
    pt.x += offsetX
    pt.y += offsetY
    const pts: Point[] = []

    let growInc = 1
    for (let i = 0; i < iterations; i++) {
      const radius = i * radiusGrowRate * growInc
      growInc *= radiusGrowScale
      const radian = offsetAngle + i * radianGrowRate
      pt.moveAlongAngle(radian, radius)
      const newPt = pt.clone()
      const lastPt = pts[pts.length - 1]

      pts.push(newPt)
      // debugDot(this.ctx, pt.x, pt.y)

      const size = lastPt ? lastPt.distanceTo(newPt) / 2 : 5
      if (i > 0) {
        this.mandalas.push(
          new Mandala({
            center: newPt,
            points: pointsMin + i * pointsIncrement,
            radius: size,
            sketch: this,
            debug,
          })
        )
      }
    }
  }

  trimGutter() {
    const { gutter } = this.vars
    this.ctx.clearRect(-1000, -1000, 2000 + this.cw, 1000 + gutter)
    this.ctx.clearRect(-1000, this.ch - gutter, 2000 + this.cw, 1000)
    this.ctx.clearRect(-1000, -1000, 1000 + gutter, 2000 + this.ch)
    this.ctx.clearRect(this.cw - gutter, -1000, 1000, 2000 + this.ch)
  }

  draw(increment: number): void {
    // artificially slow down the drawing
    // if (increment % 500 !== 0) return

    const { speedUp } = this.vars

    if (this.done) return

    for (let i = 0; i < speedUp; i++) {
      const mandala = this.mandalas[this.currentMandalaIndex]

      mandala.draw()

      if (mandala.done) {
        this.currentMandalaIndex++

        if (this.currentMandalaIndex === this.mandalas.length) {
          this.done = true
          if (this.vs.trimToGutter.value) this.trimGutter()
          console.log('done!')
          return
        }
      }
    }
  }
}
