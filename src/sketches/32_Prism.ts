import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import { debugDot } from '../utils/debugUtils'
import {
  circleOverlapsCircles,
  getClosestButNotSamePoint,
  getClosestPoint,
  getLineIntersectionPoints,
  getPointsWhereLineIntersectsCircle,
  lineIntersectsWithAny,
  pointInCircles,
} from '../utils/geomUtils'
import { seedNoise } from '../utils/noise'
import {
  angleDiff,
  degToRad,
  radToDeg,
  randFloat,
  randFloatRange,
  smallestAngleDiff,
} from '../utils/numberUtils'
import { lineToPoints, sameFloat } from '../utils/pathUtils'
import { initPen, penUp, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import Range, { BooleanRange } from './tools/Range'

export default class Prism extends Sketch {
  // static generateGCode = false

  init() {
    this.addVar('seed', {
      initialValue: 3975,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.addVar('gutter', {
      initialValue: 10,
      min: 0,
      max: 50,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('beams', {
      initialValue: 230,
      min: 50,
      max: 300,
      step: 1,
    })
    this.addVar('obstacles', {
      initialValue: 35,
      min: 1,
      max: 100,
      step: 1,
    })
    this.addVar('obstacleTilt', {
      initialValue: Math.PI / 8,
      min: 0,
      max: Math.PI / 2,
      step: 0.0001,
    })
    this.addVar('obstacleLength', {
      initialValue: 45,
      min: 5,
      max: 100,
      step: 1,
    })
    this.addVar('maxPathChanges', {
      initialValue: 15,
      min: 2,
      max: 100,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('refractionIndex', {
      initialValue: 1.333,
      min: 1,
      max: 3.14,
      step: 0.00001,
    })
    this.vs.drawObstacleLines = new BooleanRange({
      disableRandomize: true,
      initialValue: false,
    })
    this.vs.showCenterCircle = new BooleanRange({
      disableRandomize: true,
      initialValue: true,
    })
    this.addVar('centerCircleRadius', {
      initialValue: 50,
      min: 10,
      max: 120,
      step: 1,
    })
  }

  increment = 0
  cp = new Point(this.cx, this.cy)
  obstacleBounds: [pos: Point, rad: number][] = []
  obstacleLines: Line[] = []
  obstacleLineMinMaxIntersects: Record<number, [pt1len: number, pt2len: number]> = {}
  drawingPoints: [pt: Point, angle: number, insideCircle: boolean, bounces: number][] = []
  boundLines: Line[] = []
  drawnObstacleLines = false
  currentBeamIndex = 0

  initDraw(): void {
    console.log('init draw called')
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)

    this.increment = 0
    this.currentBeamIndex = 0
    this.drawnObstacleLines = false
    this.obstacleBounds = []
    this.obstacleLines = []
    this.obstacleLineMinMaxIntersects = {}
    this.drawingPoints = []
    this.boundLines = []

    const { gutter, beams, obstacles, obstacleLength, obstacleTilt, centerCircleRadius } = this.vars

    if (this.vs.showCenterCircle.value && this.vs.drawObstacleLines.value) {
      this.ctx.strokeCircle(this.cp, centerCircleRadius)
    }

    this.boundLines.push([new Point(gutter, gutter), new Point(this.cw - gutter, gutter)])
    this.boundLines.push([
      new Point(this.cw - gutter, gutter),
      new Point(this.cw - gutter, this.ch - gutter),
    ])
    this.boundLines.push([
      new Point(this.cw - gutter, this.ch - gutter),
      new Point(gutter, this.ch - gutter),
    ])
    this.boundLines.push([new Point(gutter, this.ch - gutter), new Point(gutter, gutter)])

    let i = 0
    let panic = 0
    while (i < obstacles && panic < 100) {
      const angle = Math.PI / 2 + randFloat(obstacleTilt)
      const pos = new Point(
        randFloatRange(this.cw - gutter * 2, gutter),
        randFloatRange(this.ch - gutter * 2, gutter)
      )
      const line: Line = [
        pos.clone().moveAlongAngle(angle, obstacleLength / 2),
        pos.clone().moveAlongAngle(angle + Math.PI, obstacleLength / 2),
      ]
      if (this.obstacleLines.length === 0 || !lineIntersectsWithAny(line, ...this.obstacleLines)) {
        this.obstacleBounds.push([pos, obstacleLength / 2])
        this.obstacleLines.push(line)
        this.obstacleLineMinMaxIntersects[i] = [9999, 9999]
        // this.ctx.strokeLine(...line)
        i++
        panic = 0
      } else {
        panic++
      }
    }

    // const linesSpace = (this.ch - gutter * 2) / this.vs.beams.value
    // for (let i = 0; i < beams; i++) {
    //   this.drawingPoints.push([new Point(gutter, gutter + 0.5 + i * linesSpace), 0, false, 0])
    // }
    this.startNewLine()
  }

  startNewLine() {
    const { gutter, beams } = this.vars
    if (this.currentBeamIndex >= beams) return
    const linesSpace = (this.ch - gutter * 2) / this.vs.beams.value
    this.drawingPoints.push([
      new Point(gutter, gutter + 0.5 + this.currentBeamIndex * linesSpace),
      0,
      false,
      0,
    ])
    this.currentBeamIndex++
  }

  drawLines(drawingPoints: typeof this.drawingPoints) {
    for (const [pt, angle, insideCircle, bounces] of drawingPoints) {
      const line: Line = [pt, pt.clone().moveAlongAngle(angle, this.cw * 1.5)]

      let lineIntersectionPoints = getLineIntersectionPoints(
        line,
        ...this.obstacleLines,
        ...this.boundLines
      )
      if (this.vs.showCenterCircle.value) {
        lineIntersectionPoints = lineIntersectionPoints.filter(
          ([pt]) => this.cp.distanceTo(pt) > this.vars.centerCircleRadius
        )
      }
      const circleIntersectionPoints = this.vs.showCenterCircle.value
        ? getPointsWhereLineIntersectsCircle(line, this.cp, this.vars.centerCircleRadius)
        : []
      const intersectionPoints = [...lineIntersectionPoints, ...circleIntersectionPoints]

      const boundaryIntersectionPoint = getLineIntersectionPoints(line, ...this.boundLines).map(
        ([pt]) => pt
      )

      if (!intersectionPoints.length) {
        this.startNewLine()
        continue
      }

      const closestPt = getClosestButNotSamePoint(
        pt,
        ...[...lineIntersectionPoints.map(([pt]) => pt), ...circleIntersectionPoints]
      )
      if (!closestPt) {
        this.startNewLine()
        continue
      }

      const hitLine = lineIntersectionPoints.find(([pt]) => pt === closestPt)?.[1]
      line[1] = closestPt

      const hitBoundary = boundaryIntersectionPoint.some((pt) => pt.equals(closestPt))
      const hitCircle = circleIntersectionPoints.some((pt) => pt.equals(closestPt))

      if (hitCircle || !(hitBoundary && angle === 0)) {
        this.ctx.strokeLine(...line)
      }

      const lineIndex = this.obstacleLines.findIndex((line) => line === hitLine)

      if (this.vs.drawObstacleLines.value && lineIndex >= 0) {
        this.obstacleLineMinMaxIntersects[lineIndex][0] = Math.min(
          this.obstacleLineMinMaxIntersects[lineIndex][0],
          hitLine[0].distanceTo(closestPt)
        )
        this.obstacleLineMinMaxIntersects[lineIndex][1] = Math.min(
          this.obstacleLineMinMaxIntersects[lineIndex][1],
          hitLine[1].distanceTo(closestPt)
        )
      }

      if (hitBoundary) {
        this.startNewLine()
        continue
      }
      if (bounces > this.vars.maxPathChanges) {
        this.startNewLine()
        continue
      }

      if (hitCircle) {
        const intersectionAngle = this.cp.angleTo(closestPt) + (insideCircle ? 0 : Math.PI)
        const intersectionAngleDiff = angleDiff(intersectionAngle, angle)

        const refractionAngle =
          intersectionAngle + Math.asin(Math.sin(intersectionAngleDiff) / this.vars.refractionIndex)

        this.drawingPoints.push([closestPt.clone(), refractionAngle, true, bounces + 1])
      } else {
        const intersectionAngle =
          Point.angleBetween(hitLine[0] as Point, hitLine[1] as Point) + Math.PI / 2

        const intersectionAngleDiff = smallestAngleDiff(intersectionAngle, angle)

        const refractionAngle =
          intersectionAngle + Math.asin(Math.sin(intersectionAngleDiff) / this.vars.refractionIndex)

        this.drawingPoints.push([closestPt.clone(), refractionAngle, false, bounces + 1])
      }
    }
  }

  draw(increment: number): void {
    if (this.drawingPoints.length === 0) {
      if (!this.drawnObstacleLines) {
        if (this.vs.drawObstacleLines.value) {
          for (const [i, [pt1len, pt2len]] of Object.entries(this.obstacleLineMinMaxIntersects)) {
            if (pt1len === 9999 || pt2len === 9999) continue
            const line = this.obstacleLines[parseInt(i)]
            const angle = Point.angleBetween(line[0], line[1])
            const pt1 = line[0].clone().moveAlongAngle(angle, pt1len)
            const pt2 = line[1].clone().moveAlongAngle(angle + Math.PI, pt2len)
            this.ctx.strokeLine(pt1, pt2)
          }
        }
        penUp(this)
        this.drawnObstacleLines = true
      }
      return
    }
    const drawingPoints = [...this.drawingPoints]
    this.drawingPoints = []
    this.drawLines(drawingPoints)
    this.increment++
  }
}
