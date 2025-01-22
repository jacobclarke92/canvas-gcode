import { deg1, deg90, deg180, deg360 } from '../constants/angles'
import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import { getLineIntersectionPoint } from '../utils/geomUtils'
import { randFloatRange, randIntRange } from '../utils/numberUtils'
import { initPen, plotBounds } from '../utils/penUtils'
import { random, seedRandom } from '../utils/random'

interface LineSegment {
  pt1: Point
  pt2: Point
  length: number
  touchL?: LineSegment
  touchR?: LineSegment
}

interface SegmentIntersection {
  pt: Point
  lineSeg: LineSegment
}

export default class Genuary12_Subdivision extends Sketch {
  init() {
    this.addVar('seed', { initialValue: 3994, min: 1000, max: 5000, step: 1 })
    this.addVar('gutter', { initialValue: 10, min: 0, max: 50, step: 1 })
    this.addVar('maxLines', { initialValue: 1000, min: 1, max: 24000, step: 1 })
    this.addVar('minLineSplitLength', { initialValue: 5, min: 0.1, max: 100, step: 0.1 })
    this.addVar('midpointDrift', { initialValue: 1, min: 0, max: 1, step: 0.01 })
    this.addVar('angleRange', { initialValue: deg90, min: 0, max: deg90, step: 0.001 })
    this.addVar('angleOffset', { initialValue: 0, min: -deg90, max: deg90, step: deg1 / 2 })
  }

  mode: 'plan' | 'draw' = 'plan'
  lines: LineSegment[] = []
  lastDrawLine: LineSegment | null = null

  initDraw(): void {
    const { seed, gutter, angleRange, midpointDrift } = this.vars
    seedRandom(seed)
    // Challenge: Subdivision

    const canvasW = this.cw - gutter * 2
    const canvasH = this.ch - gutter * 2
    this.ctx.strokeRect(gutter, gutter, canvasW, canvasH)

    this.mode = 'plan'
    this.lastDrawLine = null
    this.lines = []

    this.lines.push({
      pt1: new Point(gutter, gutter),
      pt2: new Point(gutter + canvasW, gutter),
      length: canvasW,
    })
    this.lines.push({
      pt1: new Point(gutter + canvasW, gutter),
      pt2: new Point(gutter + canvasW, gutter + canvasH),
      length: canvasH,
      touchL: this.lines[0],
    })
    this.lines[0].touchR = this.lines[1]
    this.lines.push({
      pt1: new Point(gutter + canvasW, gutter + canvasH),
      pt2: new Point(gutter, gutter + canvasH),
      length: canvasW,
      touchL: this.lines[1],
    })
    this.lines[1].touchR = this.lines[2]
    this.lines.push({
      pt1: new Point(gutter, gutter + canvasH),
      pt2: new Point(gutter, gutter),
      length: canvasH,
      touchL: this.lines[2],
      touchR: this.lines[0],
    })
    this.lines[0].touchL = this.lines[3]

    const pt = new Point(
      this.cp.x + randFloatRange((canvasW / 2) * midpointDrift),
      this.cp.y + randFloatRange((canvasH / 2) * midpointDrift)
    )
    const angle = randFloatRange(angleRange, -angleRange)

    const line: Line = [
      pt.clone().moveAlongAngle(angle, 500),
      pt.clone().moveAlongAngle(angle + deg180, 500),
    ]

    const intersectionPts: SegmentIntersection[] = []
    for (const testLine of this.lines) {
      const intersectionPt = getLineIntersectionPoint(line, [testLine.pt1, testLine.pt2])
      if (intersectionPt) intersectionPts.push({ pt: intersectionPt, lineSeg: testLine })
    }

    this.spliceLine(intersectionPts[0], intersectionPts[1])
  }

  spliceLine(segSect1: SegmentIntersection, segSect2: SegmentIntersection): void {
    const lineSegIndex1 = this.lines.findIndex((lineSeg) => lineSeg === segSect1.lineSeg)

    const newLineSeg: LineSegment = {
      pt1: segSect1.pt,
      pt2: segSect2.pt,
      length: segSect1.pt.distanceTo(segSect2.pt),
    }

    const splitSeg1_1: LineSegment = {
      pt1: segSect1.lineSeg.pt1,
      pt2: segSect1.pt,
      length: segSect1.lineSeg.pt1.distanceTo(segSect1.pt),
      touchL: segSect1.lineSeg.touchL,
      touchR: newLineSeg,
    }

    const splitSeg1_2: LineSegment = {
      pt1: segSect1.pt,
      pt2: segSect1.lineSeg.pt2,
      length: segSect1.pt.distanceTo(segSect1.lineSeg.pt2),
      touchL: newLineSeg,
      touchR: segSect1.lineSeg.touchR,
    }

    newLineSeg.touchL = splitSeg1_1

    const splitSeg2_1: LineSegment = {
      pt1: segSect2.lineSeg.pt1,
      pt2: segSect2.pt,
      length: segSect2.lineSeg.pt1.distanceTo(segSect2.pt),
      touchL: segSect2.lineSeg.touchL,
      touchR: newLineSeg,
    }

    const splitSeg2_2: LineSegment = {
      pt1: segSect2.pt,
      pt2: segSect2.lineSeg.pt2,
      length: segSect2.pt.distanceTo(segSect2.lineSeg.pt2),
      touchL: newLineSeg,
      touchR: segSect2.lineSeg.touchR,
    }

    newLineSeg.touchR = splitSeg2_2

    this.lines.splice(
      lineSegIndex1,
      1,
      ...[splitSeg1_1, splitSeg1_2, newLineSeg, splitSeg2_1, splitSeg2_2]
    )

    const lineSegIndex2 = this.lines.findIndex((lineSeg) => lineSeg === segSect2.lineSeg)
    this.lines.splice(lineSegIndex2, 1)

    this.ctx.strokeLine(newLineSeg.pt1, newLineSeg.pt2)
  }

  beginDrawMode(): void {
    this.ctx.reset()
    initPen(this)
    plotBounds(this)

    const { gutter } = this.vars
    const canvasW = this.cw - gutter * 2
    const canvasH = this.ch - gutter * 2
    this.ctx.strokeRect(gutter, gutter, canvasW, canvasH)

    this.mode = 'draw'
    this.lastDrawLine = this.lines[0]
    this.lines.shift()
    this.ctx.strokeLine(this.lastDrawLine.pt1, this.lastDrawLine.pt2)
  }

  draw(increment: number): void {
    const { gutter, maxLines, minLineSplitLength, angleRange, angleOffset, midpointDrift } =
      this.vars
    if (this.mode === 'plan') {
      if (increment > maxLines) return this.beginDrawMode()

      const viableLines = this.lines.filter((line) => line.length > minLineSplitLength)
      if (!viableLines.length) return this.beginDrawMode()

      const randLine = viableLines[randIntRange(viableLines.length - 1)]

      const actualLength = randLine.length - minLineSplitLength
      const startingPt = randLine.pt1
        .clone()
        .moveTowards(
          randLine.pt2,
          randLine.length / 2 +
            randFloatRange((actualLength / 2) * midpointDrift, (-actualLength / 2) * midpointDrift)
        )
      let angle = randLine.pt1.angleTo(randLine.pt2) - deg90 + angleOffset
      angle += randFloatRange(angleRange, -angleRange)
      if (random() > 0.5) angle += deg180

      const line: Line = [startingPt, startingPt.clone().moveAlongAngle(angle, 500)]

      const intersections: SegmentIntersection[] = []
      for (let i = 0; i < this.lines.length; i++) {
        const testLine = this.lines[i]
        if (testLine === randLine) continue
        const intersectionPt = getLineIntersectionPoint(
          line,
          [testLine.pt1, testLine.pt2] /*[
          testLine.pt1.clone().moveTowards(testLine.pt2, minLineSplitLength / 2),
          testLine.pt2.clone().moveTowards(testLine.pt1, minLineSplitLength / 2),
        ]*/
        )
        if (intersectionPt) intersections.push({ pt: intersectionPt, lineSeg: testLine })
      }

      if (!intersections.length) return

      intersections.sort((a, b) => a.pt.distanceTo(startingPt) - b.pt.distanceTo(startingPt))
      if (startingPt.distanceTo(intersections[0].pt) < minLineSplitLength) return

      this.spliceLine({ pt: startingPt, lineSeg: randLine }, intersections[0])

      // finally draw it weeeeee
    } else if (this.mode === 'draw') {
      if (this.lines.length <= 0) return

      const closestLine = this.lines.reduce(
        (closest, line) => {
          const dist = Math.min(
            line.pt1.distanceTo(this.lastDrawLine!.pt2),
            line.pt2.distanceTo(this.lastDrawLine!.pt2)
          )
          return dist < closest.dist ? { dist, line } : closest
        },
        { dist: Infinity, line: this.lines[0] }
      ).line

      if (
        this.lastDrawLine.pt2.distanceTo(closestLine.pt2) <
        this.lastDrawLine.pt2.distanceTo(closestLine.pt1)
      ) {
        this.lastDrawLine = {
          pt1: closestLine.pt2,
          pt2: closestLine.pt1,
          length: closestLine.length,
        }
      } else {
        this.lastDrawLine = closestLine
      }

      this.ctx.strokeLine(this.lastDrawLine.pt1, this.lastDrawLine.pt2)

      const index = this.lines.indexOf(closestLine)
      this.lines.splice(index, 1)
    }
  }
}
