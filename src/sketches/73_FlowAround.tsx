import { ClipType, PolyFillType } from 'js-angusj-clipper/web'

import { deg360 } from '../constants/angles'
import type GCanvas from '../GCanvas'
import Point from '../Point'
import type { SketchState } from '../Sketch'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import type { Circle } from '../utils/geomUtils'
import { circleOverlapsCircles, getBezierPoints, pointInCircle } from '../utils/geomUtils'
import { perlin2, seedNoise } from '../utils/noise'
import { clamp, randFloatRange, randIntRange } from '../utils/numberUtils'
import { initPen, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

class Strand {
  done: boolean
  ctx: GCanvas
  pt: Point
  pts: Point[]
  bezierPts: Point[]
  angle: number
  lineSegCount = 0
  constructor({
    pt,
    ctx,
    angle,
    bezierPts,
  }: {
    pt: Point
    ctx: GCanvas
    angle: number
    bezierPts: Point[]
  }) {
    this.done = false
    this.ctx = ctx
    this.pt = pt
    this.pts = [pt.clone()]
    this.bezierPts = bezierPts
    this.angle = angle
  }
}

export default class FlowAround extends Sketch {
  // static disableOverclock = true
  static sketchState: SketchState = 'unfinished'

  init() {
    this.addVar('seed', { initialValue: 3994, min: 1000, max: 5000, step: 1 })
    this.addVar('gutterX', { initialValue: 0.1, min: 0, max: 1, step: 0.001 })
    this.addVar('gutterY', { initialValue: 0.25, min: 0, max: 1, step: 0.001 })
    // this.addVar('speedUp', { initialValue: 0, min: 1, max: 50, step: 1 })
    this.addVar('numLines', { initialValue: 10, min: 1, max: 150, step: 1 })
    this.addVar('numObstacles', { initialValue: 10, min: 1, max: 50, step: 1 })
    this.addVar('obstacleMinSize', { initialValue: 5, min: 1, max: 10, step: 0.1 })
    this.addVar('obstacleMaxSize', { initialValue: 15, min: 3, max: 25, step: 0.1 })
    this.addVar('perlinDiv', {
      initialValue: 25,
      min: 1,
      max: 200,
      step: 0.1,
      disableRandomize: true,
    })
    this.addVar('perlinOffsetX', { initialValue: 0, min: 0, max: 250, step: 1 })
    this.addVar('perlinOffsetY', { initialValue: 0, min: 0, max: 250, step: 1 })
    this.addVar('obstacleBufferSize', { initialValue: 8, min: 0, max: 10, step: 0.1 })
    this.addVar('regionRepelForce', { initialValue: 1.8, min: 0, max: 100, step: 0.1 })
    this.addVar('regionAvoidRadiusOffset', { initialValue: 1, min: 0.1, max: 2, step: 0.01 })
    this.addVar('initialAngleFade', { initialValue: 1.02, min: 1, max: 1.25, step: 0.001 })
    this.addVar('initialAngleRange', {
      initialValue: Math.PI * 2,
      min: 0.001,
      max: Math.PI * 2,
      step: 0.001,
    })
    this.addVar('speedTowardsEndPt', { initialValue: 0.5, min: 0, max: 1, step: 0.01 })
    this.addVar('speedThroughNoise', { initialValue: 0.5, min: 0, max: 5, step: 0.01 })
    this.addVar('bezierIntensity', { initialValue: 120, min: 0, max: 500, step: 1 })
    this.addVar('bezierSpeed', { initialValue: 0.5, min: 0, max: 2, step: 0.01 })
  }

  strandsDone = 0
  strands: Strand[]
  obstacles: Circle[] = []
  currentStrandIndex = 0
  touchedObstacleIndexes: number[] = []
  startPoint = new Point(0, this.ch * 0.5)
  endPoint = new Point(this.cw, this.ch * 0.5)

  initDraw(): void {
    seedRandom(this.vars.seed)
    seedNoise(this.vars.seed)

    const {
      gutterX,
      gutterY,
      numLines,
      numObstacles,
      obstacleMinSize,
      obstacleMaxSize,
      bezierIntensity,
      initialAngleRange,
    } = this.vars

    this.startPoint = new Point(this.cw * gutterX, this.ch * 0.5)
    this.endPoint = new Point(this.cw * (1 - gutterX), this.ch * 0.5)
    // debugDot(this.ctx, this.startPoint)
    // debugDot(this.ctx, this.endPoint)

    this.obstacles = []
    this.touchedObstacleIndexes = []
    for (let i = 0; i < numObstacles; i++) {
      const circleX = randIntRange(this.cw * (1 - gutterX), this.cw * gutterX)
      const percentFromCenter = 1 - Math.abs(this.cw / 2 - circleX) / (this.cw * (1 - gutterX * 2))
      const circle: Circle = [
        new Point(circleX, randIntRange(this.ch * (1 - gutterY * 1.2), this.ch * gutterY)),
        randIntRange(obstacleMaxSize, obstacleMinSize) * percentFromCenter,
      ]
      if (circleOverlapsCircles(circle, ...this.obstacles)) i--
      else this.obstacles[i] = circle
    }
    // this.obstacles.forEach((circle) => this.ctx.strokeCircle(...circle))

    this.strandsDone = 0
    this.strands = []
    this.currentStrandIndex = 0
    for (let i = 0; i < numLines; i++) {
      // const angle = randFloatRange(Math.PI, -Math.PI)
      const angle = (i / numLines) * initialAngleRange - initialAngleRange / 2
      const bezierPts = getBezierPoints(
        this.startPoint,
        this.startPoint.clone().moveAlongAngle(angle, bezierIntensity),
        this.endPoint.clone().moveAlongAngle(Math.PI + angle, bezierIntensity),
        this.endPoint,
        50
      )
      this.strands[i] = new Strand({
        ctx: this.ctx,
        pt: this.startPoint.clone(),
        angle,
        bezierPts,
      })
    }
  }

  drawFinal() {
    this.ctx.reset()
    initPen(this)
    plotBounds(this)
    for (const strand of this.strands) {
      this.ctx.beginPath()
      this.ctx.moveTo(strand.pts[0].x, strand.pts[0].y)
      for (let i = 1; i < strand.pts.length - 1; i++) {
        this.ctx.lineTo(strand.pts[i].x, strand.pts[i].y)
      }
      this.ctx.stroke()
      this.ctx.endPath()
    }
  }

  draw(increment: number): void {
    // artificially slow down the drawing
    // if (increment % 500 !== 0) return

    const {
      gutterX,
      gutterY,
      perlinDiv,
      perlinOffsetX,
      perlinOffsetY,
      regionAvoidRadiusOffset,
      regionRepelForce,
      obstacleBufferSize,
      initialAngleFade,
      speedThroughNoise,
      speedTowardsEndPt,
      bezierSpeed,
    } = this.vars

    for (const strand of this.strands) {
      if (strand.done) continue
      const noiseAngleForPos = perlin2(
        (strand.pt.x + perlinOffsetX) / perlinDiv,
        (strand.pt.y + perlinOffsetY) / perlinDiv
      )
      const distFromEndPt = this.endPoint.distanceTo(strand.pt)

      // if (strand.pts.length >= 4) {
      //   const trajectoryAngle = strand.pts[strand.pts.length - 4].angleTo(strand.pts[strand.pts.length - 1])
      //   strand.pt.moveAlongAngle(trajectoryAngle, 1)
      // }

      // const xPercent = (strand.pt.x - this.startPoint.x) / (this.endPoint.x - this.startPoint.x)
      const xPercent = strand.pt.x / (this.cw - this.startPoint.x)
      const bezierPtIndex = clamp(
        Math.floor(xPercent * (strand.bezierPts.length - 1)),
        0,
        strand.bezierPts.length - 1
      )
      const bezierPt = strand.bezierPts[bezierPtIndex]

      strand.pt
        .moveAlongAngle(strand.angle, 1)
        .moveAlongAngle(noiseAngleForPos * Math.PI, speedThroughNoise)
        .moveTowards(bezierPt, bezierSpeed)
        .moveTowards(this.endPoint, speedTowardsEndPt * Math.max(1, (100 - distFromEndPt) / 10))

      const closestObstacles = this.obstacles.sort(
        (a, b) => b[0].distanceTo(strand.pt) - a[0].distanceTo(strand.pt)
      )

      // const angleToClosestObstacle = strand.pt.angleTo(closestObstacles[0][0])
      // strand.pt.moveAlongAngle(angleToClosestObstacle, 0.5)

      for (let i = 0; i < closestObstacles.length; i++) {
        const [pt, radius] = closestObstacles[i]
        if (!pointInCircle(strand.pt, pt, radius + obstacleBufferSize)) continue

        if (!this.touchedObstacleIndexes.includes(i)) this.touchedObstacleIndexes.push(i)
        const proximityToCenter =
          ((radius + obstacleBufferSize) * regionAvoidRadiusOffset - pt.distanceTo(strand.pt)) /
          radius
        strand.pt.moveAway(pt, regionRepelForce * proximityToCenter)
      }

      const distFromLast = strand.pts[strand.pts.length - 1].distanceTo(strand.pt)
      strand.lineSegCount++
      if (distFromLast > 1) {
        strand.pts.push(strand.pt.clone())
        strand.angle /= initialAngleFade
        this.ctx.strokeLine(strand.pts[strand.pts.length - 1], strand.pts[strand.pts.length - 2])
      }
      if (
        strand.pt.x > this.cw * (1 - gutterX) ||
        strand.pt.y < this.ch * gutterY ||
        strand.pt.y > this.ch * (1 - gutterY) ||
        strand.lineSegCount > 2500
      ) {
        strand.done = true
        this.strandsDone++
        if (this.strandsDone === this.strands.length) {
          this.drawFinal()
        }
      }
    }
  }
}
