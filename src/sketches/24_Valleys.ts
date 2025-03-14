import { deg90, deg360 } from '../constants/angles'
import Point from '../Point'
import { Sketch } from '../Sketch'
import { getPointsWhereLineIntersectsCircle, pointInCircle } from '../utils/geomUtils'
import { randFloat } from '../utils/numberUtils'
import { initPen, penUp, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'

type Pos = [number, number]

export default class Valleys extends Sketch {
  // static generateGCode = false

  init() {
    this.addVar('speedUp', { initialValue: 1, min: 1, max: 100, step: 1, disableRandomize: true })
    this.addVar('randSeed', {
      initialValue: 5321,
      min: 1000,
      max: 10000,
      step: 1,
      disableRandomize: true,
    })

    this.addVar('mainAngle', { initialValue: 1.169, min: 0, max: deg360, step: 0.001 })

    this.addVar('lineDrift', { initialValue: 0.45, min: 0, max: 1, step: 0.01 })
    this.addVar('lineStretchy', { initialValue: 0.4, min: 0, max: 1, step: 0.01 })
    this.addVar('lineConformance', { initialValue: 0.75, min: 0, max: 1, step: 0.001 })
    this.addVar('jointSpace', { initialValue: 1.25, min: 0.5, max: 5, step: 0.01 })
    this.addVar('mountainJointsHeight', { initialValue: 10, min: 0, max: 20, step: 1 })
    this.addVar('circleRadius', { initialValue: 40, min: 5, max: this.ch / 1.333, step: 1 })

    this.addVar('spaceBetween', { initialValue: 15, min: 1, max: 200, step: 1 })
    this.addVar('valleysEitherSide', { initialValue: 4, min: 1, max: 10, step: 1 })
  }

  stopDrawing = false
  increment = 0

  lines: Point[][] = []
  drawingLineIndex = 1
  lineSegIndex = 0

  initDraw(): void {
    seedRandom(this.vars.randSeed)
    initPen(this)
    plotBounds(this)

    this.lines = []
    this.drawingLineIndex = 1
    this.lineSegIndex = 0

    this.stopDrawing = false
    this.increment = 0

    const ctxRadius = (this.cw + this.ch) / 3

    const perpAngle = this.vars.mainAngle + deg90

    const startPt = new Point(
      this.cw / 2 + Math.cos(this.vars.mainAngle) * ctxRadius,
      this.ch / 2 + Math.sin(this.vars.mainAngle) * ctxRadius
    )

    const endPt = new Point(
      this.cw / 2 + Math.cos(this.vars.mainAngle + Math.PI) * ctxRadius,
      this.ch / 2 + Math.sin(this.vars.mainAngle + Math.PI) * ctxRadius
    )

    const linePts = this.generateLinePts(startPt, endPt)
    this.drawLinePts(linePts)
    this.lines.push(linePts)

    for (let i = 0; i < this.vars.valleysEitherSide; i++) {
      const leftLinePts = this.generateLinePts(
        startPt.clone().moveAlongAngle(perpAngle, -this.vars.spaceBetween * (i + 1)),
        endPt.clone().moveAlongAngle(perpAngle, -this.vars.spaceBetween * (i + 1))
      )
      this.drawLinePts(leftLinePts)
      this.lines.unshift(leftLinePts)
      const rightLinePts = this.generateLinePts(
        startPt.clone().moveAlongAngle(perpAngle, this.vars.spaceBetween * (i + 1)),
        endPt.clone().moveAlongAngle(perpAngle, this.vars.spaceBetween * (i + 1))
      )
      this.drawLinePts(rightLinePts)
      this.lines.push(rightLinePts)
    }

    // this.ctx.strokeCircle(this.cp, this.vars.circleRadius)
  }

  generateLinePts(startPt: Point, endPt: Point) {
    const alignmentAngle = Math.atan2(endPt.y - startPt.y, endPt.x - startPt.x)
    const pts = [startPt]
    let currentPt = startPt.clone()
    let direction = alignmentAngle
    let closestToEnd = 999999
    let lastDist = closestToEnd
    let ohBabyDontStop = true
    while (ohBabyDontStop) {
      direction += randFloat(this.vars.lineDrift)
      currentPt = currentPt.moveAlongAngle(
        direction,
        this.vars.jointSpace * (1 + randFloat(this.vars.lineStretchy))
      )
      direction += (alignmentAngle - direction) * this.vars.lineConformance // ease back to alignment
      pts.push(currentPt.clone())
      const distToEnd = currentPt.distanceTo(endPt)
      if (distToEnd < closestToEnd) closestToEnd = distToEnd
      if (lastDist === closestToEnd && distToEnd > closestToEnd) {
        ohBabyDontStop = false
      }
      lastDist = distToEnd
    }
    // console.log('closest to end', closestToEnd)
    return pts
  }

  drawLinePts(pts: Point[]) {
    this.ctx.beginPath()
    let started = false
    pts.forEach((pt, i) => {
      if (i < 1) return
      if (
        pointInCircle(pts[i - 1], this.cp, this.vars.circleRadius) &&
        pointInCircle(pt, this.cp, this.vars.circleRadius)
      ) {
        if (!started) {
          this.ctx.moveTo(pts[i - 1].x, pts[i - 1].y)
          started = true
        } else {
          this.ctx.lineTo(pt.x, pt.y)
        }
      }
    })
    this.ctx.stroke()
  }

  draw(increment: number): void {
    if (this.stopDrawing) return
    const { circleRadius } = this.vars
    this.increment++

    const line1 =
      this.lines[this.drawingLineIndex % 2 ? this.drawingLineIndex - 1 : this.drawingLineIndex]
    const line2 =
      this.lines[this.drawingLineIndex % 2 ? this.drawingLineIndex : this.drawingLineIndex - 1]
    const maxLineSegments = Math.min(line1.length, line2.length) - this.vars.mountainJointsHeight

    const pt1 = line1[this.lineSegIndex]
    const pt2 = line2[this.lineSegIndex + this.vars.mountainJointsHeight]
    if (pt1 && pt2) {
      // const intersectionPoints = getPointsWhereLineIntersectsCircle(
      //   [pt1, pt2],
      //   this.cp,
      //   circleRadius
      // )

      if (pointInCircle(pt1, this.cp, circleRadius) && pointInCircle(pt2, this.cp, circleRadius)) {
        this.ctx.beginPath()
        this.ctx.moveTo(pt1.x, pt1.y)
        this.ctx.lineTo(pt2.x, pt2.y)
        this.ctx.stroke()
      }

      // if (intersectionPoints.length === 0) {
      //   // this.ctx.closePath()
      // } else if (intersectionPoints.length === 2) {
      //   this.ctx.beginPath()
      //   this.ctx.moveTo(intersectionPoints[0].x, intersectionPoints[0].y)
      //   this.ctx.lineTo(intersectionPoints[1].x, intersectionPoints[1].y)
      //   this.ctx.stroke()
      // }
    }

    this.lineSegIndex++
    if (this.lineSegIndex >= maxLineSegments) {
      this.lineSegIndex = 0
      this.drawingLineIndex++
      if (this.drawingLineIndex >= this.lines.length) {
        this.stopDrawing = true
        penUp(this)
      }
    }
  }
}
