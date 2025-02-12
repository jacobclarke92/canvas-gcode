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
    sketch: ctx,
    debug,
  }: {
    center: Point
    points: number
    radius: number
    sketch: Sketch
    debug?: boolean
  }) {
    this.sketch = ctx
    this.debug = debug
    this.cPt = center

    // For n points, each point connects to (n-1) other points
    // This counts each line twice (once from each end)
    // So we divide by 2 to get the actual number of unique lines
    this.totalLines = points + (points * (points - 1)) / 2

    // this.skipCount = 0
    this.done = false
    this.currentRadialIndex = 0
    this.currentTestIndex = 0
    this.segAng = deg360 / points
    this.radius = radius
    this.drawnLines = new Set()

    if (debug) {
      for (let i = 0; i < points; i++) {
        debugDot(
          ctx.ctx,
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

    const indexDiff = Math.abs(this.currentRadialIndex - this.currentTestIndex)

    const lineAlreadyDrawn = this.hasDrawn(this.currentRadialIndex, this.currentTestIndex)
    const needToAvoid =
      avoidUntil > 0 && (indexDiff < avoidUntil || indexDiff > this.points - avoidUntil)

    if (needToAvoid) {
      // add it anyway so it can be easily skipped later
      this.drawnLines.add(makeKey(this.currentRadialIndex, this.currentTestIndex))
    }

    if (lineAlreadyDrawn || needToAvoid || this.currentRadialIndex === this.currentTestIndex) {
      this.currentTestIndex++
      if (this.currentTestIndex === this.points) {
        this.currentRadialIndex++
        this.currentTestIndex = 0
      }
      // this.skipCount++
      // continue
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

    if (this.debug) {
      this.sketch.ctx.strokeTriangle(
        this.cPt.x + Math.cos(endAng) * this.radius,
        this.cPt.y + Math.sin(endAng) * this.radius,
        // direction:
        Math.atan2(
          Math.sin(startAng) * this.radius - Math.sin(endAng) * this.radius,
          Math.cos(startAng) * this.radius - Math.cos(endAng) * this.radius
        ),

        // distance:
        10
      )
    }

    this.drawnLines.add(makeKey(this.currentRadialIndex, this.currentTestIndex))
    this.currentRadialIndex = this.currentTestIndex
    this.currentTestIndex = 0
  }
}

export default class MandalaVariations extends Sketch {
  init() {
    this.addVar('seed', { initialValue: 3994, min: 1000, max: 5000, step: 1 })
    this.addVar('speedUp', { initialValue: 32, min: 1, max: 50, step: 1 })
    this.addVar('gutter', { presentation: true, initialValue: 0.05, min: 0, max: 0.4, step: 0.001 })
    this.addVar('rows', { initialValue: 3, min: 1, max: 10, step: 1 })
    this.addVar('cols', { initialValue: 4, min: 1, max: 10, step: 1 })
    this.addVar('pointsMin', { initialValue: 32, min: 5, max: 128, step: 1 })
    this.addVar('pointsIncrement', { initialValue: 1, min: 1, max: 32, step: 1 })
    this.addVar('avoidUntil', { initialValue: 0, min: 0, max: 32, step: 1 })
    this.addVar('curveDistance', { initialValue: 0.01, min: -100, max: 100, step: 0.1 })
    this.addVar('curveLean', { initialValue: 1, min: -1, max: 32, step: 0.01 })
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

    const { gutter, rows, cols, pointsMin, pointsIncrement } = this.vars
    const debug = !!this.vs.debug.value

    const gutterWidth = this.cw * gutter
    const availableWidth = this.cw - gutterWidth * 2
    const availableHeight = this.ch - gutterWidth * 2
    const cellWidth = availableWidth / cols
    const cellHeight = availableHeight / rows

    let points = pointsMin
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const center = new Point(
          gutterWidth + cellWidth * c + cellWidth / 2,
          gutterWidth + cellHeight * r + cellHeight / 2
        )
        const radius = (Math.min(cellWidth, cellHeight) / 2) * 0.8
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
