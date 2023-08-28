import Point from '../Point'
import { Sketch } from '../Sketch'
import { Line } from '../types'
import { debugDot } from '../utils/debugUtils'
import { getClosestPoint, getLineIntersectionPoints, getPointsWhereLineIntersectsCircle } from '../utils/geomUtils'
import { smallestAngleDiff, degToRad, radToDeg, randFloat, randFloatRange, angleDiff } from '../utils/numberUtils'
import { lineToPoints, sameFloat } from '../utils/pathUtils'
import { seedRandom } from '../utils/random'
import Range from './tools/Range'

export default class Rays extends Sketch {
  // static generateGCode = false

  init() {
    this.vs.stopAfter = new Range({ initialValue: 36, min: 1, max: 420, step: 1, disableRandomize: true })
    this.vs.maxRadius = new Range({
      initialValue: this.ch * 0.45,
      min: 1,
      max: this.ch * 0.5,
      step: 0.1,
      disableRandomize: true,
    })

    this.vs.seed = new Range({ initialValue: 2254, min: 1000, max: 5000, step: 1 })
    this.vs.lines = new Range({ initialValue: 36, min: 3, max: 720, step: 1 })
  }

  increment = 0
  reflectiveCircles: [pos: Point, rad: number, density: number][] = []

  initDraw(): void {
    console.log('init draw called')
    this.increment = 0
    this.reflectiveCircles = []
    seedRandom(this.vs.seed.value)

    for (let i = 0; i < 5; i++) {
      const pos = new Point(randFloatRange(this.cw), randFloatRange(this.ch))
      const rad = randFloatRange(5, 20)
      const density = randFloatRange(0.1, 1)
      this.reflectiveCircles.push([pos, rad, density])
      this.ctx.strokeCircle(pos, rad)
    }

    const cp = new Point(this.cx, this.cy)
    for (let i = 0; i < this.vs.lines.value; i++) {
      const lineAngle = degToRad((360 / this.vs.lines.value) * i)
      const line: Line = [
        new Point(this.cx, this.cy),
        new Point(this.cx, this.cy).moveAlongAngle(lineAngle, this.ch * 0.8),
      ]
      let intersectionPoints: [intersection: Point, circle: Point, radius: number][] = []
      for (const [pos, rad, density] of this.reflectiveCircles) {
        const lineAngleCirclePosDiff = angleDiff(lineAngle, line[0].angleTo(pos))
        // console.log('angle to circle:', radToDeg(lineAngleCirclePosDiff, true))
        if (lineAngleCirclePosDiff > degToRad(90) || lineAngleCirclePosDiff < degToRad(-90)) continue
        for (const intersectionPoint of getPointsWhereLineIntersectsCircle(line, pos, rad)) {
          intersectionPoints.push([intersectionPoint, pos, rad])
        }
      }
      if (intersectionPoints.length) {
        const closestPt = getClosestPoint(cp, ...intersectionPoints.map(([pt]) => pt))
        const [pt, circlePos, radius] = intersectionPoints.find(([pt]) => pt === closestPt)!
        line[1] = pt

        // normal
        const intersectionAngle = circlePos.angleTo(closestPt)
        // this.ctx.strokeLine(...[pt, pt.clone().moveAlongAngle(intersectionAngle, 2)])

        const intersectionAngleDiff = smallestAngleDiff(intersectionAngle, lineAngle + Math.PI)

        const reflectionAngle = intersectionAngle + intersectionAngleDiff
        this.ctx.strokeLine(...[pt, pt.clone().moveAlongAngle(reflectionAngle, 8)])

        console.log('intersectionAngleDiff:', radToDeg(intersectionAngleDiff, true))
      }
      this.ctx.strokeLine(...line)
      // debugger
    }
  }

  draw(increment: number): void {}
}
