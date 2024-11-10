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

export default class StringArt extends Sketch {
  init() {
    this.addVar('seed', { initialValue: 3994, min: 1000, max: 5000, step: 1 })
    this.addVar('speedUp', { initialValue: 32, min: 1, max: 50, step: 1 })
    this.addVar('gutter', { presentation: true, initialValue: 0.05, min: 0, max: 0.4, step: 0.001 })
    this.addVar('points', { initialValue: 32, min: 5, max: 128, step: 1 })
    this.addVar('avoidUntil', { initialValue: 6, min: 0, max: 32, step: 1 })
    this.vs.debug = new BooleanRange({ disableRandomize: true, initialValue: false })
  }

  totalLines = 0
  // skipCount = 0
  done = false
  segAng = 0
  radius = 0
  drawnLines: Set<string>
  currentRadialIndex = 0
  currentTestIndex = 0

  hasDrawn = (i1: number, i2: number) => this.drawnLines.has(makeKey(i1, i2))

  initDraw(): void {
    seedRandom(this.vars.seed)
    initPen(this)
    plotBounds(this)

    const { points, gutter } = this.vars

    // For n points, each point connects to (n-1) other points
    // This counts each line twice (once from each end)
    // So we divide by 2 to get the actual number of unique lines
    this.totalLines = points + (points * (points - 1)) / 2

    // this.skipCount = 0
    this.done = false
    this.currentRadialIndex = 0
    this.currentTestIndex = 0
    this.segAng = (Math.PI * 2) / points
    this.radius = (this.ch - this.ch * gutter * 2) / 2
    this.drawnLines = new Set()

    if (this.vs.debug.value) {
      for (let i = 0; i < points; i++) {
        debugDot(
          this.ctx,
          this.cx + Math.cos(this.segAng * i) * this.radius,
          this.cy + Math.sin(this.segAng * i) * this.radius
        )
      }
    }
  }

  draw(increment: number): void {
    // artificially slow down the drawing
    // if (increment % 500 !== 0) return

    const { speedUp, points, avoidUntil } = this.vars

    if (this.done) return

    for (let i = 0; i < speedUp; i++) {
      if (this.drawnLines.size === this.totalLines) {
        this.done = true
        console.log('done!')
        return
      }
      // if (this.skipCount >= points * points) {
      //   this.done = true
      //   console.log('done!')
      //   return
      // }

      const indexDiff = Math.abs(this.currentRadialIndex - this.currentTestIndex)

      const lineAlreadyDrawn = this.hasDrawn(this.currentRadialIndex, this.currentTestIndex)
      const needToAvoid =
        avoidUntil > 0 && (indexDiff < avoidUntil || indexDiff > points - avoidUntil)

      if (needToAvoid) {
        // add it anyway so it can be easily skipped later
        this.drawnLines.add(makeKey(this.currentRadialIndex, this.currentTestIndex))
      }

      if (lineAlreadyDrawn || needToAvoid || this.currentRadialIndex === this.currentTestIndex) {
        this.currentTestIndex++
        if (this.currentTestIndex === points) {
          this.currentRadialIndex++
          this.currentTestIndex = 0
        }
        // this.skipCount++
        continue
      }

      const startAng = this.segAng * this.currentRadialIndex
      const endAng = this.segAng * this.currentTestIndex

      this.ctx.beginPath()
      this.ctx.moveTo(
        this.cx + Math.cos(startAng) * this.radius,
        this.cy + Math.sin(startAng) * this.radius
      )
      this.ctx.lineTo(
        this.cx + Math.cos(endAng) * this.radius,
        this.cy + Math.sin(endAng) * this.radius
      )
      this.ctx.stroke()
      if (this.vs.debug.value) {
        this.ctx.strokeTriangle(
          this.cx + Math.cos(endAng) * this.radius,
          this.cy + Math.sin(endAng) * this.radius,
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
      // this.skipCount = 0
    }
  }
}
