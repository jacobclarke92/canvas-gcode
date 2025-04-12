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

export default class MandalaVariations extends Sketch {
  // static disableOverclock = true

  init() {
    this.addVar('seed', { initialValue: 3994, min: 1000, max: 5000, step: 1 })
    this.addVar('speedUp', { initialValue: 0, min: 1, max: 50, step: 1 })
    this.addVar('gutterX', {
      presentation: true,
      initialValue: 0.05,
      min: 0,
      max: 0.4,
      step: 0.001,
    })
    this.addVar('gutterY', {
      presentation: true,
      initialValue: 0.05,
      min: 0,
      max: 0.4,
      step: 0.001,
    })
    this.addVar('rows', { initialValue: 3, min: 1, max: 10, step: 1 })
    this.addVar('cols', { initialValue: 4, min: 1, max: 10, step: 1 })
    this.addVar('spacing', { initialValue: 0.2, min: 0, max: 1, step: 0.01 })
    this.addVar('pointsMin', { initialValue: 5, min: 5, max: 128, step: 1 })
    this.addVar('pointsIncrement', { initialValue: 1, min: 1, max: 32, step: 1 })
    this.addVar('avoidUntil', { initialValue: 0, min: 0, max: 32, step: 1 })
    this.addVar('curveDistance', { initialValue: 0.01, min: -100, max: 100, step: 0.1 })
    this.addVar('curveLean', { initialValue: 1, min: -1, max: 3, step: 0.01 })
    this.vs.debug = new BooleanRange({ disableRandomize: true, initialValue: false })
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

    const { gutterX, gutterY, rows, cols, spacing, pointsMin, pointsIncrement } = this.vars
    const debug = !!this.vs.debug.value

    const gutterWidth = this.cw * gutterX
    const gutterHeight = this.ch * gutterY
    const availableWidth = this.cw - gutterWidth * 2
    const availableHeight = this.ch - gutterHeight * 2
    const cellWidth = availableWidth / cols
    const cellHeight = availableHeight / rows

    let points = pointsMin
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const center = new Point(
          gutterWidth + cellWidth * c + cellWidth / 2,
          gutterHeight + cellHeight * r + cellHeight / 2
        )
        const radius = (Math.min(cellWidth, cellHeight) / 2) * (1 - spacing)
        this.mandalas.push(new Mandala({ center, points, radius, sketch: this, debug }))
        points += pointsIncrement
      }
    }
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
          console.log('done!')
          return
        }
      }
    }
  }
}
