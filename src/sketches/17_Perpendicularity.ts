import Point from '../Point'
import { Sketch } from '../Sketch'
import { Line } from '../types'
import { getLineIntersectionPoints } from '../utils/geomUtils'
import { degToRad, randFloat, randFloatRange } from '../utils/numberUtils'
import { lineToPoints, sameFloat } from '../utils/pathUtils'
import { seedRandom } from '../utils/random'
import Range from './tools/Range'

export default class Perpendicularity extends Sketch {
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

    this.vs.seed = new Range({ initialValue: 2222, min: 1000, max: 5000, step: 1 })

    this.vs.segments = new Range({ initialValue: 6, min: 3, max: 15, step: 1 })
    this.vs.segmentAngleWonk = new Range({ initialValue: 0, min: 0, max: 1, step: 0.001 })
    this.vs.radialSpawnPoints = new Range({ initialValue: 1, min: 0, max: 10, step: 1 })

    this.vs.offsetPerpAngle = new Range({ initialValue: Math.PI / 2 - 0.1, min: 0, max: Math.PI, step: 0.001 })
    this.vs.offsetPerpAngleWonk = new Range({ initialValue: 0, min: 0, max: 1, step: 0.001 })
  }

  cp = new Point(this.cx, this.cy)

  increment = 0
  segmentAngles: number[] = []
  segmentsLines: Line[] = []

  drawnLines: Line[] = []
  nextSpawnPoints: [Point, Line][] = []

  drawLineFromPointAtAngle(startPoint: Point, originalLine: Line, offsetAngle: number = Math.PI / 2) {
    const lineAngle = originalLine[0].angleTo(originalLine[1])

    const startPtAngleFromCenter = this.cp.angleTo(startPoint)

    let angle = lineAngle + offsetAngle

    // flip angle 180° if these match
    if (sameFloat(startPtAngleFromCenter, lineAngle)) {
      angle += Math.PI
    }

    const testLine: Line = [startPoint, startPoint.clone().moveAlongAngle(angle, 1000)]

    let intersectionPointAndLines = getLineIntersectionPoints(testLine, ...this.drawnLines)
      .map(([pt, line]) => [pt, line, startPoint.distanceTo(pt)] as [Point, Line, number])
      .filter(([, , dist]) => dist > 0.001)
      .sort(([, , dist1], [, , dist2]) => dist1 - dist2)

    if (!intersectionPointAndLines.length) {
      testLine[1] = testLine[0].clone().moveAlongAngle(angle + Math.PI, 1000)
      intersectionPointAndLines = getLineIntersectionPoints(testLine, ...this.drawnLines)
        .map(([pt, line]) => [pt, line, startPoint.distanceTo(pt)] as [Point, Line, number])
        .filter(([, , dist]) => dist > 0.001)
        .sort(([, , dist1], [, , dist2]) => dist1 - dist2)
    }

    if (intersectionPointAndLines.length > 0) {
      const [closestIntersectionPoint, closestIntersectionLine] = intersectionPointAndLines[0]
      testLine[1] = closestIntersectionPoint
      this.nextSpawnPoints.push([closestIntersectionPoint, closestIntersectionLine])
    }

    this.drawnLines.push(testLine)
    this.ctx.strokeLine(...testLine)
  }

  initDraw(): void {
    console.log('init draw called')
    this.increment = 0
    this.segmentAngles = []
    this.segmentsLines = []
    this.drawnLines = []
    this.nextSpawnPoints = []
    seedRandom(this.vs.seed.value)

    const midPt = new Point(this.cx, this.cy)
    const segAngle = degToRad(360 / this.vs.segments.value)

    let angle = 0
    for (let a = 0; a < this.vs.segments.value; a++) {
      const angleWonkAmount = randFloatRange(this.vs.segmentAngleWonk.value)
      angle += segAngle + randFloatRange(-segAngle * angleWonkAmount, segAngle * angleWonkAmount)
      this.segmentAngles.push(angle)
      const segEndPt = new Point(
        this.cx + Math.cos(angle) * this.vs.maxRadius.value,
        this.cy + Math.sin(angle) * this.vs.maxRadius.value
      )
      const line: Line = [midPt, segEndPt]
      this.segmentsLines.push(line)
      this.drawnLines.push(line)
      // this.ctx.strokeLine(...line)
    }

    // draw lines to close shape
    for (let s = 0; s < this.vs.segments.value; s++) {
      const closingLine: Line = [
        this.segmentsLines[s][1],
        this.segmentsLines[s === this.vs.segments.value - 1 ? 0 : s + 1][1],
      ]
      this.drawnLines.push(closingLine)
      // this.ctx.strokeLine(...closingLine)
    }

    // start initial lines spawning off of segment lines
    for (let s = 0; s < this.vs.segments.value; s++) {
      const line = this.segmentsLines[s]
      const startPoints = lineToPoints(...line, this.vs.radialSpawnPoints.value)
      for (let r = 0; r < this.vs.radialSpawnPoints.value; r++) {
        this.drawLineFromPointAtAngle(startPoints[r], line, this.vs.offsetPerpAngle.value)
      }
    }
  }

  draw(increment: number): void {
    if (this.increment > this.vs.stopAfter.value) return
    const spawnPoints = [...this.nextSpawnPoints]
    this.nextSpawnPoints = []
    for (let [pt, line] of spawnPoints) {
      const angle = this.vs.offsetPerpAngle.value + randFloat(this.vs.offsetPerpAngleWonk.value)
      this.drawLineFromPointAtAngle(pt, line, angle)
    }
    this.increment++
  }
}
