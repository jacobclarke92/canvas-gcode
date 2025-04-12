import { deg45, deg90 } from '../constants/angles'
import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import { linesIntersect } from '../utils/geomUtils'
import { randFloatRange } from '../utils/numberUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

export default class VanishingPoint extends Sketch {
  // static generateGCode = false

  stopDrawing = false
  increment = 0

  vanishingPoints: Point[]
  planes: [Point, Point, Point, Point][]
  planeCenterPoints: [pt: Point, radius: number][]

  init() {
    this.addVar('speedUp', { initialValue: 1, min: 1, max: 100, step: 1, disableRandomize: true })
    this.addVar('randSeed', {
      initialValue: 4973,
      min: 1000,
      max: 10000,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('stopAfter', {
      initialValue: 50000,
      min: 5,
      max: 100000,
      step: 1,
      disableRandomize: true,
    })

    this.vs.cutout = new BooleanRange({ disableRandomize: true, initialValue: true })
    this.addVar('padding', { initialValue: 20, min: 0, max: 150, step: 1 })
    this.addVar('vanishingPoints', { initialValue: 3, min: 1, max: 10, step: 1 })
    this.addVar('planes', { initialValue: 32, min: 1, max: 36, step: 1 })
    this.addVar('planeMinSize', { initialValue: 8, min: 1, max: 100, step: 0.25 })
    this.addVar('planeMaxSize', { initialValue: 20, min: 1, max: 250, step: 0.25 })
    this.addVar('planeSpacingThreshold', { initialValue: 1.5, min: 1, max: 10, step: 0.1 })

    this.addVar('testRotation', { initialValue: 0, min: 0, max: deg90, step: 0.001 })
  }

  initDraw(): void {
    seedRandom(this.vars.randSeed)
    this.stopDrawing = false
    this.increment = 0
    this.planes = []
    this.vanishingPoints = []
    this.planeCenterPoints = []

    const cutout = !!this.vs.cutout.value

    for (let i = 0; i < this.vars.vanishingPoints; i++) {
      this.vanishingPoints.push(new Point(randFloatRange(this.cw), randFloatRange(this.ch)))
    }
    for (let i = 0; i < this.vars.planes; i++) {
      const radius = randFloatRange(this.vars.planeMinSize, this.vars.planeMaxSize) / 2
      let centerPoint: Point = new Point(
        this.vars.padding + randFloatRange(this.cw - this.vars.padding * 2),
        this.vars.padding + randFloatRange(this.ch - this.vars.padding * 2)
      )
      let panic = 0
      while (
        ++panic < 1000 &&
        this.planeCenterPoints.some(
          ([pt, rad2]) =>
            pt.distanceTo(centerPoint) < (radius + rad2) * this.vars.planeSpacingThreshold
        )
      ) {
        centerPoint = new Point(
          this.vars.padding + randFloatRange(this.cw - this.vars.padding * 2),
          this.vars.padding + randFloatRange(this.ch - this.vars.padding * 2)
        )
      }
      this.planeCenterPoints.push([centerPoint, radius])

      const plane: Point[] = []
      // this.ctx.beginPath()
      for (let a = 0; a < 4; a++) {
        const angle = a * deg90 + deg45 + this.vars.testRotation
        const x = centerPoint.x + radius * Math.cos(angle)
        const y = centerPoint.y + radius * Math.sin(angle)
        plane.push(new Point(x, y))
        // if (a === 0) this.ctx.moveTo(x, y)
        // else this.ctx.lineTo(x, y)
      }
      // this.ctx.lineTo(plane[0].x, plane[0].y)
      // this.ctx.stroke()
      // this.ctx.endPath()
      this.planes.push(plane as [Point, Point, Point, Point])
    }

    this.vanishingPoints.forEach((vp) => {
      this.planes
        // sort furthest to closest
        .sort((a, b) => {
          const aCenter = a.reduce((acc, pt) => acc.add(pt), new Point(0, 0)).divide(4)
          const bCenter = b.reduce((acc, pt) => acc.add(pt), new Point(0, 0)).divide(4)
          return vp.distanceTo(bCenter) - vp.distanceTo(aCenter)
        })
        .forEach((plane) => {
          const planeCenter = plane.reduce((acc, pt) => acc.add(pt), new Point(0, 0)).divide(4)

          console.log(planeCenter.distanceTo(vp))

          const distances = plane
            .map(
              (pt) =>
                [pt, vp.distanceTo(pt), vp.angleBetween(pt)] as [
                  pt: Point,
                  dist: number,
                  angle: number
                ]
            )
            .sort((a, b) => a[1] - b[1])
          distances.pop()

          // debugDot(this.ctx, distances[1][0], 'red')
          // debugDot(this.ctx, distances[0][0], 'green')
          // debugDot(this.ctx, distances[2][0], 'blue')
          const line1: Line = [distances[1][0], distances[0][0]]
          const line2: Line = [distances[2][0], vp]
          if (linesIntersect(line1, line2)) distances.pop()

          if (distances.length === 3) {
            console.log('3 points')
            this.ctx.beginPath()
            this.ctx.moveTo(distances[1][0].x, distances[1][0].y)
            this.ctx.lineTo(distances[0][0].x, distances[0][0].y)
            this.ctx.lineTo(distances[2][0].x, distances[2][0].y)
            this.ctx.lineTo(vp.x, vp.y)
            this.ctx.lineTo(distances[1][0].x, distances[1][0].y)
            this.ctx.stroke({ cutout })
            this.ctx.endPath()

            this.ctx.beginPath()
            this.ctx.moveTo(distances[0][0].x, distances[0][0].y)
            this.ctx.lineTo(vp.x, vp.y)
            this.ctx.stroke()
            this.ctx.endPath()
          } else if (distances.length === 2) {
            console.log('2 points')
            this.ctx.beginPath()
            this.ctx.moveTo(distances[0][0].x, distances[0][0].y)
            this.ctx.lineTo(distances[1][0].x, distances[1][0].y)
            this.ctx.lineTo(vp.x, vp.y)
            this.ctx.lineTo(distances[0][0].x, distances[0][0].y)
            this.ctx.stroke({ cutout })
            this.ctx.endPath()
          }

          // distances.forEach(([pt, dist], i) => {
          //   this.ctx.beginPath()
          //   this.ctx.moveTo(pt.x, pt.y)
          //   this.ctx.lineTo(vp.x, vp.y)
          //   this.ctx.stroke({ debug: false /*i === 0 || i === 2*/ })
          //   this.ctx.endPath()
          // })
        })
    })

    this.planes.forEach((plane) => {
      this.ctx.beginPath()
      this.ctx.moveTo(plane[0].x, plane[0].y)
      this.ctx.lineTo(plane[1].x, plane[1].y)
      this.ctx.lineTo(plane[2].x, plane[2].y)
      this.ctx.lineTo(plane[3].x, plane[3].y)
      this.ctx.lineTo(plane[0].x, plane[0].y)
      this.ctx.stroke({ cutout })
      this.ctx.endPath()
    })
  }

  draw(increment: number): void {
    if (this.stopDrawing) return

    const {} = this.vars
  }
}
