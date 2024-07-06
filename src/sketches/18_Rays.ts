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
  pointInCircles,
} from '../utils/geomUtils'
import {
  angleDiff,
  degToRad,
  radToDeg,
  randFloat,
  randFloatRange,
  smallestAngleDiff,
} from '../utils/numberUtils'
import { lineToPoints, sameFloat } from '../utils/pathUtils'
import { initPen, penUp } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import Range from './tools/Range'

export default class Rays extends Sketch {
  // static generateGCode = false

  init() {
    this.vs.stopAfter = new Range({
      initialValue: 3,
      min: 1,
      max: 256,
      step: 1,
      disableRandomize: true,
    })
    this.vs.maxRadius = new Range({
      initialValue: this.ch * 0.45,
      min: 1,
      max: this.ch * 0.5,
      step: 0.1,
      disableRandomize: true,
    })

    this.vs.seed = new Range({
      initialValue: 3975,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.vs.lines = new Range({
      initialValue: 500,
      min: 3,
      max: 720,
      step: 1,
      disableRandomize: true,
    })
    this.vs.lineAngleWonk = new Range({
      initialValue: 0,
      min: 0,
      max: 1,
      step: 0.0001,
    })
    this.vs.circles = new Range({
      initialValue: 3,
      min: 1,
      max: 10,
      step: 1,
      disableRandomize: true,
    })
    this.vs.refractionIndex = new Range({
      initialValue: 1,
      min: 1,
      max: 2,
      step: 0.00001,
      disableRandomize: true,
    })
  }

  increment = 0
  reflectiveCircles: [pos: Point, rad: number][] = []
  drawingPoints: [pt: Point, angle: number, insideShape: boolean][] = []
  cp = new Point(this.cx, this.cy)

  initDraw(): void {
    console.log('init draw called')
    initPen(this)

    this.increment = 0
    this.reflectiveCircles = []
    this.drawingPoints = []
    seedRandom(this.vs.seed.value)
    // this.vs.stopAfter.setValue(Math.min(this.vs.stopAfter.value, this.vs.lines.value / 20), true)

    let i = 0
    while (i < this.vs.circles.value) {
      const rad = randFloatRange(5, 20)
      const pos = new Point(
        randFloatRange(this.cw - rad * 2, rad),
        randFloatRange(this.ch - rad * 2, rad)
      )
      if (!circleOverlapsCircles([pos, rad], ...this.reflectiveCircles)) {
        this.reflectiveCircles.push([pos, rad])
        // this.ctx.strokeCircle(pos, rad)
        i++
      }
    }

    const startingInsideCircle = pointInCircles(
      this.cp,
      ...this.reflectiveCircles
    )
    const segAngle = (Math.PI * 2) / this.vs.lines.value
    for (let i = 0; i < this.vs.lines.value; i++) {
      const lineAngle =
        segAngle * i + randFloat(this.vs.lineAngleWonk.value) * segAngle
      this.drawingPoints.push([this.cp, lineAngle, startingInsideCircle])
    }
  }

  drawLines(drawingPoints: typeof this.drawingPoints) {
    for (const [pt, angle, insideShape] of drawingPoints) {
      const line: Line = [pt, pt.moveAlongAngle(angle, 1000)]
      const intersectionPoints: [
        intersection: Point,
        circle: Point,
        radius: number
      ][] = []
      for (const [pos, rad] of this.reflectiveCircles) {
        const lineAngleCirclePosDiff = angleDiff(angle, line[0].angleTo(pos))
        // console.log('angle to circle:', radToDeg(lineAngleCirclePosDiff, true))
        if (
          lineAngleCirclePosDiff > degToRad(90) ||
          lineAngleCirclePosDiff < degToRad(-90)
        )
          continue
        for (const intersectionPoint of getPointsWhereLineIntersectsCircle(
          line,
          pos,
          rad
        )) {
          intersectionPoints.push([intersectionPoint, pos, rad])
        }
      }
      if (intersectionPoints.length) {
        // if (!pt.equals(this.cp)) {
        //   intersectionPoints.forEach(([ipt, pos, rad]) => {
        //     // debugDot(this.ctx, ipt, 'red')
        //     console.log(ipt, pt.distanceTo(ipt))
        //   })
        // }

        const closestPt = getClosestButNotSamePoint(
          pt,
          ...intersectionPoints.map(([pt]) => pt)
        )
        const [, circlePos, radius] = intersectionPoints.find(
          ([pt]) => pt === closestPt
        )!
        line[1] = closestPt

        // normal
        const intersectionAngle = circlePos.angleTo(closestPt)
        // this.ctx.strokeLine(...[pt, pt.clone().moveAlongAngle(intersectionAngle, 2)])

        const intersectionAngleDiff = smallestAngleDiff(
          intersectionAngle,
          angle + Math.PI
        )

        const reflectionAngle =
          intersectionAngle +
          intersectionAngleDiff +
          (insideShape ? Math.PI : 0)
        // this.ctx.strokeLine(...[pt, pt.clone().moveAlongAngle(reflectionAngle, 8)])
        // if (!insideShape) this.drawingPoints.push([closestPt.clone(), reflectionAngle, false])

        /*
      refraction index = 1.33
      incoming angle = 45deg
      
      sin(45) = 1.33 * sin(Θr)
      sin(45) / 1.33 = sin(Θr)
      
      asin(sin(45) / 1.33) = Θr
      */

        const refractionAngle =
          intersectionAngle +
          Math.PI -
          Math.asin(
            Math.sin(intersectionAngleDiff) / this.vs.refractionIndex.value
          )
        // this.ctx.strokeLine(...[closestPt, closestPt.clone().moveAlongAngle(refractionAngle, 8)])
        this.drawingPoints.push([closestPt.clone(), refractionAngle, true])

        // this.ctx.strokeStyle = insideShape ? 'red' : 'black'
        this.ctx.strokeLine(...line)
      } else {
        // this.ctx.strokeStyle = insideShape ? 'red' : 'black'
        // this.ctx.strokeLine(...line)
      }
      // debugger
    }
  }

  draw(increment: number): void {
    if (this.increment >= this.vs.stopAfter.value) {
      penUp(this)
      return
    }
    const drawingPoints = [...this.drawingPoints]
    this.drawingPoints = []
    this.drawLines(drawingPoints)
    this.increment++
  }
}
