import { Clipper } from '../packages/Clipper/Clipper'
import { IntPoint } from '../packages/Clipper/IntPoint'
import type { IntRectangle } from '../packages/Clipper/IntRectangle'
import type { Path as ClipperPath } from '../packages/Clipper/Path'
import { Paths } from '../packages/Clipper/Path'
import Point from '../Point'
import { Sketch } from '../Sketch'
import { DEFAULT_DIVISIONS } from '../SubPath'
// import type { Line } from '../types'
import {
  getClosestButNotSamePoint,
  getLineIntersectionPoints,
  lineIntersectsCircles,
  lineIntersectsWithAny,
} from '../utils/geomUtils'
import { randFloat, randFloatRange, randIntRange, wrap } from '../utils/numberUtils'
import type { SimplifiedSvgPathSegment } from '../utils/pathToCanvasCommands'
import { pathToCanvasCommands } from '../utils/pathToCanvasCommands'
import { svgPathToShape } from '../utils/pathUtils'
import { seedRandom } from '../utils/random'
import Range, { BooleanRange } from './tools/Range'

type Line = [IntPoint, IntPoint]

export default class Yes extends Sketch {
  static generateGCode = false
  static enableCutouts = true

  private increment = 0
  private linesDrawn = 0

  private pathsCommands: SimplifiedSvgPathSegment[][] = []
  private outlines: ClipperPath[] = []
  private bounds: IntRectangle[] = []
  private outlinesEdges: Line[][] = []
  private insideLines: Line[][] = []
  private insidePts: Point[][] = []
  private outsidePts: Point[] = []

  init() {
    this.vs.speedUp = new Range({ initialValue: 1, min: 1, max: 100, step: 1, disableRandomize: true })
    this.vs.stopAfterLinesDrawn = new Range({
      initialValue: 1000,
      min: 1,
      max: 10000,
      step: 1,
      disableRandomize: true,
    })
    this.vs.seed = new Range({ initialValue: 9275, min: 1000, max: 5000, step: 1 })
    this.vs.pointGenAmount = new Range({ initialValue: 5000, min: 0, max: 10000, step: 1 })
    this.vs.minPointSpacing = new Range({ initialValue: 2, min: 0, max: 15, step: 0.25 })
    this.vs.maxLineJoinDist = new Range({ initialValue: 12, min: 0.5, max: 150, step: 0.5 })
    this.vs.minLineJoinDist = new Range({ initialValue: 0, min: 0, max: 100, step: 0.25 })
    this.vs.allowLineCrossing = new BooleanRange({ initialValue: false })
    this.vs.maxLineCrossings = new Range({ requires: 'allowLineCrossing', initialValue: 0, min: 0, max: 10, step: 1 })
    this.vs.letterStrokeWidth = new Range({ initialValue: 0, min: 0, max: 4.5, step: 0.001, disableRandomize: true })
    this.vs.lineWidth = new Range({ initialValue: 0.25, min: 0.001, max: 8, step: 0.001, disableRandomize: true })
    this.vs.outerCircleStrokeWidth = new Range({ initialValue: 0.15, min: 0.001, max: 1, step: 0.001 })
    this.vs.outerCircleSurvival = new Range({ initialValue: 0, min: 0, max: 1, step: 0.001 })
    this.vs.outerCircleSize = new Range({ initialValue: 0.5, min: 0, max: 5, step: 0.001 })
    this.vs.innerCircleSize = new Range({ initialValue: 0.3, min: 0, max: 5, step: 0.001 })
    this.vs.curveQuality = new Range({ initialValue: 20, min: 3, max: 500, step: 1 })

    this.pathsCommands[0] = pathToCanvasCommands('m59.4 1.5-19 55V81H18.7V56.4L0 1.5h24l5.8 25.9h1l5.6-25.9h23Z', true) // prettier-ignore
    this.pathsCommands[1] = pathToCanvasCommands('M108 81H65V1.5h44.3L108 21.1H87V33h18.3v16.9H86.9v13.2h22.4L108 81Z', true) // prettier-ignore
    this.pathsCommands[2] = pathToCanvasCommands('M113.2 25.4c0-7.5 2.2-13.6 6.6-18.3A24 24 0 0 1 138 .2c7.8 0 15.7.8 23.8 2.3L159.3 23c-8.5-2-14.3-3-17.5-3-4 0-6 1.7-6 5 0 1.2 1 2.5 2.8 3.6l7 3.9c2.8 1.3 5.5 2.8 8.3 4.7 2.7 1.8 5 4.4 6.9 7.8 2 3.4 3 7.4 3 11.8 0 8.1-2.2 14.4-6.6 18.8-4.3 4.5-10.5 6.7-18.6 6.7-7.9 0-15.7-1.3-23.3-3.7l1.5-19.1c9 2.6 15.4 4 19 4 3.6 0 5.4-1.6 5.4-4.8 0-1.6-1-3-3-4.5a49.3 49.3 0 0 0-6.9-4 93 93 0 0 1-8.3-4.8c-2.7-1.8-5-4.4-7-7.8a24.9 24.9 0 0 1-2.8-12.2Z', true) // prettier-ignore
    // this.pathsCommands[3] = pathToCanvasCommands('M177.4 56.7 176 1.5h21.8L196 56.7h-18.6Z', true)  // prettier-ignore
    // this.pathsCommands[4] = pathToCanvasCommands('m-1.7 15.6c0-3.4 1-6 2.7-7.6 1.8-1.7 4.7-2.5 8.6-2.5 4 0 6.8.8 8.6 2.5 1.8 1.7 2.7 4.3 2.7 7.9 0 6.5-3.8 9.8-11.3 9.8-7.5 0-11.3-3.4-11.3-10.1Z', true) // prettier-ignore
  }

  initDraw(): void {
    seedRandom(this.vs.seed.value)

    this.increment = 0
    this.linesDrawn = 0

    this.outlines = this.pathsCommands.map((pathCommands) => {
      const shape = svgPathToShape(pathCommands)
      const pts = shape.getPoints(this.vs.curveQuality.value)
      return pts
    })

    this.bounds = this.ctx.pathHistory.map((subPath, i) => {
      const paths = new Paths([this.outlines[i]])
      return Clipper.getBounds(paths)
    })

    this.outlinesEdges = this.outlines.map((outline) =>
      outline.map((pt, i) => [pt, outline[wrap(i + 1, outline.length)]])
    )
    this.outlines.forEach((o, i) => (this.insidePts[i] = []))
    this.outlines.forEach((o, i) => (this.insideLines[i] = []))

    if (this.vs.letterStrokeWidth.value > 0) {
      this.ctx.ctx.lineWidth = this.vs.letterStrokeWidth.value
      this.pathsCommands.forEach((pathCommands) => {
        this.ctx.strokeSvgPath(pathCommands)
      })
    }
    this.ctx.ctx.lineWidth = this.vs.lineWidth.value
  }

  draw(increment: number): void {
    for (let i = 0; i < this.vs.speedUp.value; i++) {
      this.increment++

      if (this.increment < this.vs.pointGenAmount.value) {
        const randPt = new Point(randFloatRange(this.cw), randFloatRange(this.ch))
        let anyInside = false
        for (let o = 0; o < this.outlines.length; o++) {
          const outline = this.outlines[o]
          // const randPt = new Point(
          //   randFloatRange(this.bounds[o].right, this.bounds[o].left),
          //   randFloatRange(this.bounds[o].bottom, this.bounds[o].top)
          // )

          const inside = Clipper.pointInPolygon(randPt, outline)

          if (inside) {
            anyInside = true
            if (
              this.insidePts[o].length > 1 &&
              getClosestButNotSamePoint(randPt, ...this.insidePts[o]).distanceTo(randPt) < this.vs.minPointSpacing.value
            ) {
              continue
            }
            if (this.vs.innerCircleSize.value > 0) {
              this.ctx.fillCircle(randPt, this.vs.innerCircleSize.value)
            }
            this.insidePts[o].push(randPt)
          }
        }
        if (!anyInside) {
          if (this.vs.outerCircleSize.value > 0 && randFloatRange(1, 0) < this.vs.outerCircleSurvival.value) {
            if (
              !this.outsidePts.length ||
              getClosestButNotSamePoint(randPt, ...this.outsidePts).distanceTo(randPt) > this.vs.minPointSpacing.value
            ) {
              this.ctx.ctx.lineWidth = this.vs.outerCircleStrokeWidth.value
              this.ctx.strokeCircle(randPt, this.vs.outerCircleSize.value)
              this.ctx.ctx.lineWidth = this.vs.lineWidth.value
              this.outsidePts.push(randPt)
            }
          }
        }
      } else if (this.linesDrawn < this.vs.stopAfterLinesDrawn.value) {
        for (let o = 0; o < this.outlines.length; o++) {
          if (!this.insidePts[o].length) continue
          const randPt1 = this.insidePts[o][randIntRange(this.insidePts[o].length - 1)]
          const randPt2 = this.insidePts[o][randIntRange(this.insidePts[o].length - 1)]
          if (IntPoint.op_Equality(randPt1, randPt2)) continue
          const lineLength = randPt1.distanceTo(randPt2)
          if (lineLength > this.vs.maxLineJoinDist.value) continue
          if (lineLength < this.vs.minLineJoinDist.value) continue
          if (lineIntersectsWithAny([randPt1, randPt2], ...this.outlinesEdges[o])) continue

          if (this.vs.allowLineCrossing.value) {
            const intersectionPoints = getLineIntersectionPoints([randPt1, randPt2], ...this.insideLines[o])
            if (intersectionPoints.length > this.vs.maxLineCrossings.value) continue
          } else {
            if (lineIntersectsWithAny([randPt1, randPt2], ...this.insideLines[o])) continue
          }

          this.ctx.strokeLine(randPt1, randPt2)
          this.insideLines[o].push([randPt1, randPt2])
          this.linesDrawn++
        }
      }
    }
  }
}
