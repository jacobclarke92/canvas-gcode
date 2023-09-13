import { Clipper } from '../packages/Clipper/Clipper'
import type { IntPoint } from '../packages/Clipper/IntPoint'
import type { IntRectangle } from '../packages/Clipper/IntRectangle'
import type { Path as ClipperPath } from '../packages/Clipper/Path'
import { Paths } from '../packages/Clipper/Path'
import Point from '../Point'
import { Sketch } from '../Sketch'
// import type { Line } from '../types'
import {
  circleOverlapsCircles,
  getClosestButNotSamePoint,
  getLineIntersectionPoints,
  lineIntersectsWithAny,
  pointInCircles,
} from '../utils/geomUtils'
import { perlin2, seedNoise } from '../utils/noise'
import { randFloat, randFloatRange, randIntRange, wrap } from '../utils/numberUtils'
import type { SimplifiedSvgPathSegment } from '../utils/pathToCanvasCommands'
import { pathToCanvasCommands } from '../utils/pathToCanvasCommands'
import { svgPathToShape } from '../utils/pathUtils'
import { seedRandom } from '../utils/random'
import Range, { BooleanRange } from './tools/Range'

type Line = [IntPoint, IntPoint]

export default class Aeroplane extends Sketch {
  static generateGCode = false

  init() {
    this.addVar('speedUp', { initialValue: 1, min: 1, max: 100, step: 1, disableRandomize: true })
    this.addVar('seed', { initialValue: 9275, min: 1000, max: 5000, step: 1 })
    this.addVar('stopAfter', { initialValue: 100, min: 5, max: 5000, step: 1 })
    this.addVar('startRadius', { initialValue: 6, min: 1, max: 20, step: 0.1 })
    this.addVar('radiusVary', { initialValue: 0, min: 0, max: 2, step: 0.01 })
    this.addVar('radiusReductionDiv', { initialValue: 1.1, min: 1.01, max: 5, step: 0.01 })
    this.addVar('radiusFitDiv', { initialValue: 1.1, min: 1.01, max: 10, step: 0.01 })
    this.addVar('perlinDivX', { initialValue: 75, min: 1, max: 100, step: 1 })
    this.addVar('perlinDivY', { initialValue: 75, min: 1, max: 100, step: 1 })
    this.addVar('perlinOffsetX', { initialValue: 0, min: -100, max: 100, step: 1 })
    this.addVar('perlinOffsetY', { initialValue: 0, min: -100, max: 100, step: 1 })
  }

  increment = 0
  currentPos = new Point(0, 0)
  lastRadius = 0
  circles: [pt: Point, radius: number][] = []

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)
    this.increment = 0

    this.circles = []
    this.lastRadius = 0
    this.currentPos.x = randIntRange(this.cw)
    this.currentPos.y = randIntRange(this.ch)
  }

  draw(increment: number): void {
    const { startRadius, radiusReductionDiv, radiusVary, perlinDivX, perlinDivY, perlinOffsetX, perlinOffsetY } =
      this.vars

    if (this.increment < this.vars.stopAfter) {
      for (let i = 0; i < this.vs.speedUp.value; i++) {
        this.increment++

        let nextRadius: number
        let nextPos: Point

        if (this.lastRadius <= 0) {
          let panic1 = 0
          while (panic1 < 1000 && (!nextRadius || nextRadius <= 0)) {
            panic1++
            nextRadius = startRadius + randFloat(radiusVary)
          }
          let panic2 = 0
          while (panic2 < 2000 && (!nextPos || circleOverlapsCircles([nextPos, nextRadius], ...this.circles))) {
            panic2++
            nextPos = new Point(randIntRange(this.cw), randIntRange(this.ch))
          }
          if (panic1 < 1000 && panic2 < 1000) {
            this.ctx.strokeCircle(nextPos, nextRadius)
            this.circles.push([nextPos, nextRadius])
          }
          // this.ctx.ctx.lineWidth = 0.5
        } else {
          const theta =
            perlin2(
              (this.currentPos.x + perlinOffsetX) / perlinDivX,
              (this.currentPos.y + perlinOffsetY) / perlinDivY
            ) *
            Math.PI *
            2
          nextRadius = this.lastRadius / (radiusReductionDiv * (1 + randFloat(radiusVary)))
          if (nextRadius > 0) {
            nextPos = new Point(
              this.currentPos.x + Math.cos(theta) * (this.lastRadius + nextRadius),
              this.currentPos.y + Math.sin(theta) * (this.lastRadius + nextRadius)
            )
            let panic = 0
            while (panic < 1000 && nextRadius > 0.01 && circleOverlapsCircles([nextPos, nextRadius], ...this.circles)) {
              panic++
              nextRadius /= this.vars.radiusFitDiv
              nextPos.x = this.currentPos.x + Math.cos(theta) * (this.lastRadius + nextRadius)
              nextPos.y = this.currentPos.y + Math.sin(theta) * (this.lastRadius + nextRadius)
            }

            if (nextRadius <= 0.01) {
              nextRadius = 0
            } else {
              this.ctx.strokeCircle(nextPos, nextRadius)
              this.circles.push([nextPos, nextRadius])
            }
          }
        }
        this.lastRadius = nextRadius
        if (nextRadius > 0) this.currentPos = nextPos
      }
    }
  }
}
