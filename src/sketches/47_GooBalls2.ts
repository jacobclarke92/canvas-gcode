import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import { debugDot, debugText } from '../utils/debugUtils'
import {
  circleOverlapsCircles,
  getMidPt,
  getTangentsToCircle,
  isInBounds,
  lineIntersectsWithAny,
  pointInCircle,
  pointInCircles,
  radToDeg,
  smallestSignedAngleDiff,
} from '../utils/geomUtils'
import { seedNoise } from '../utils/noise'
import { randFloatRange, randIntRange } from '../utils/numberUtils'
import { initPen, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

export default class GooBalls2 extends Sketch {
  // static generateGCode = false
  static enableCutouts = false

  init() {
    this.addVar('speedUp', {
      initialValue: 50,
      min: 1,
      max: 100,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('seed', {
      initialValue: 1620, // 1728, // 2586, // 2286, //1193,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.addVar('gutter', {
      initialValue: 12,
      min: 0,
      max: 25,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('minRadius', {
      initialValue: 10,
      min: 1,
      max: 50,
      step: 1,
    })
    this.addVar('maxRadius', {
      initialValue: 40,
      min: 1,
      max: 100,
      step: 1,
    })
    this.addVar('minGap', {
      initialValue: 0,
      min: 1,
      max: 50,
      step: 1,
    })
    this.addVar('maxGap', {
      initialValue: 30,
      min: 1,
      max: 100,
      step: 1,
    })
    this.addVar('adhesion', {
      initialValue: 10,
      min: 0,
      max: 25,
      step: 0.1,
    })
    this.addVar('minSegments', {
      initialValue: 3,
      min: 2,
      max: 12,
      step: 1,
    })
    this.addVar('maxSegments', {
      initialValue: 4,
      min: 2,
      max: 12,
      step: 1,
    })
    this.addVar('maxAngleDiff', {
      initialValue: Math.PI,
      min: 0,
      max: Math.PI,
      step: 0.01,
    })
    this.vs.showDebug = new BooleanRange({
      disableRandomize: true,
      initialValue: true,
    })
  }

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)

    this.planCreature()
  }

  planCreature(): void {
    const creature = new Creature(this)
    creature.plan(!!this.vs.showDebug.value)
    creature.draw(!!this.vs.showDebug.value)
  }

  draw(increment: number): void {
    //
  }
}

class Segment {
  pt: Point
  radius: number
  prev?: Segment
  prevJointInfo?: ReturnType<Segment['getJointInfo']>
  jointMidPtL?: Point
  jointMidPtR?: Point
  overlappedCW = false
  overlappedCCW = false

  constructor(sketch: Sketch, notFirst?: { index: number; prev: Segment; allPrev: Segment[] }) {
    const { gutter, minRadius, maxRadius, minGap, maxGap, maxAngleDiff } = sketch.vars
    this.radius = randFloatRange(minRadius, maxRadius)
    if (notFirst) {
      const { index, prev, allPrev } = notFirst
      let pt = new Point(-1, -1)

      let isInitialPt = true
      let hasPrevPrev = false
      let prevPrevAngle = 0
      if (prev.prev) {
        hasPrevPrev = true
        prevPrevAngle = prev.prev.pt.angleTo(prev.pt)
      }

      let panik = 0
      let suitableFound = false
      while (!suitableFound && ++panik < 2000) {
        const isOutOfBounds = !isInBounds(pt, [0, sketch.cw, sketch.ch, 0], gutter + this.radius)

        const overlapsExistingCircles = circleOverlapsCircles(
          [pt, this.radius],
          ...allPrev.map((seg) => [seg.pt, seg.radius] satisfies [Point, number])
        )

        const overlapsExistingJointLines = lineIntersectsWithAny(
          [
            prev.pt.clone().moveTowards(pt, prev.radius),
            pt.clone().moveTowards(prev.pt, this.radius),
          ],
          ...allPrev
            .filter((prevSeg) => prevSeg.prev)
            .map((prevSeg) => [prevSeg.pt, prevSeg.prev.pt] satisfies Line)
        )

        const existingMidPtsFallWithinNewCircle = [
          this.prevJointInfo ? [this.prevJointInfo.midPtL, this.prevJointInfo.midPtR] : [],
          ...allPrev.map((seg) =>
            seg.prevJointInfo ? [seg.prevJointInfo.midPtL, seg.prevJointInfo.midPtR] : []
          ),
        ]
          .flat()
          .some((midPt) => pointInCircle(midPt, pt, this.radius))

        const isOutsideAllowedAngledDiff =
          hasPrevPrev &&
          !isInitialPt &&
          Math.abs(smallestSignedAngleDiff(prevPrevAngle, prev.pt.angleTo(pt))) > maxAngleDiff

        if (
          isOutOfBounds ||
          overlapsExistingCircles ||
          overlapsExistingJointLines ||
          existingMidPtsFallWithinNewCircle ||
          isOutsideAllowedAngledDiff
        ) {
          isInitialPt = false
          const angle = randFloatRange(Math.PI * 2)
          const dist = randFloatRange(
            prev.radius + this.radius + maxGap,
            prev.radius + this.radius + minGap
          )
          pt = prev.pt.clone().add(new Point(Math.cos(angle) * dist, Math.sin(angle) * dist))
          this.radius = randFloatRange(minRadius, maxRadius)
          this.pt = pt
          this.prev = prev
          this.prevJointInfo = this.getJointInfo(prev, sketch.vars.adhesion)
        } else {
          suitableFound = true
        }
      }

      // const angleDiff = Math.abs(smallestSignedAngleDiff(prevPrevAngle, prev.pt.angleTo(pt)))
      // if (sketch.vs.showDebug.value)
      //   debugText(
      //     sketch.ctx,
      //     [
      //       `#${index}`,
      //       ...(hasPrevPrev
      //         ? [
      //             `pp∠: ${radToDeg(prevPrevAngle).toFixed(2)}°`,
      //             `p∠: ${radToDeg(prev.pt.angleTo(pt)).toFixed()}°`,
      //             `diff: ${radToDeg(angleDiff).toFixed(2)}°`,
      //             // `minDiff: ${radToDeg(maxAngleDiff).toFixed(2)}°`,
      //           ]
      //         : []),
      //     ].join('\n'),
      //     this.pt,
      //     { size: 3 }
      //   )
    } else {
      this.pt = new Point(
        gutter + this.radius + randFloatRange(sketch.cw - (gutter + this.radius) * 2),
        gutter + this.radius + randFloatRange(sketch.ch - (gutter + this.radius) * 2)
      )

      // if (sketch.vs.showDebug.value) debugText(sketch.ctx, `#0`, this.pt)
    }
  }

  getJointInfo(nextSeg: Segment, adhesion = 0) {
    const gapDist = this.pt.distanceTo(nextSeg.pt) - (this.radius + nextSeg.radius)
    const angle = this.pt.angleTo(nextSeg.pt)
    const midPt = this.pt.clone().moveTowards(nextSeg.pt, this.radius + gapDist / 2)
    const midPtL = midPt.clone().moveAlongAngle(angle - Math.PI / 2, adhesion)
    const midPtR = midPt.clone().moveAlongAngle(angle + Math.PI / 2, adhesion)

    const tangentPtsSegL = getTangentsToCircle(midPtL, this.pt, this.radius)
    const tangentPtsSegR = getTangentsToCircle(midPtR, this.pt, this.radius)
    const tangentPtsNextSegL = getTangentsToCircle(midPtL, nextSeg.pt, nextSeg.radius)
    const tangentPtsNextSegR = getTangentsToCircle(midPtR, nextSeg.pt, nextSeg.radius)

    const tangentPtsL = [tangentPtsSegL[1], tangentPtsNextSegL[0]] satisfies [Point, Point]
    const tangentPtsR = [tangentPtsSegR[0], tangentPtsNextSegR[1]] satisfies [Point, Point]

    return {
      midPt,
      midPtL,
      midPtR,
      tangentPtsL,
      tangentPtsR,
    }
  }
}

class Creature {
  sketch: Sketch
  ctx: Sketch['ctx']
  vars: Sketch['vars']
  segments: Segment[] = []

  constructor(sketch: Sketch) {
    this.sketch = sketch
    this.ctx = sketch.ctx
    this.vars = sketch.vars
    //
    const { gutter, minRadius, maxRadius, minGap, maxGap, adhesion, minSegments, maxSegments } =
      this.vars

    const numSegments = randIntRange(maxSegments, minSegments)
    this.segments = [new Segment(sketch)]
    for (let i = 1; i < numSegments; i++) {
      this.segments.push(
        new Segment(sketch, { index: i, prev: this.segments[i - 1], allPrev: this.segments })
      )
    }
  }

  plan(debug = false): void {
    for (let i = 1; i < this.segments.length; i++) {
      const prevSeg = this.segments[i - 1]
      const seg = this.segments[i]
      const nextSeg = this.segments[i + 1]

      const prevSegJointInfo = prevSeg.getJointInfo(seg, this.vars.adhesion)

      const isLastSegment = !nextSeg

      if (!isLastSegment) {
        // we have a segment in front and behind us
        // the first iteration of this loop will be focusing on the second segment and so will be here (if there are more than 2 segments)

        const nextSegJointInfo = seg.getJointInfo(nextSeg, this.vars.adhesion)

        // const seg2tan2angle1 = seg.pt.angleTo(prevSegJointInfo.tangentPtsR[0])
        // const seg2tan2angle2 = seg.pt.angleTo(nextSegJointInfo.tangentPtsL[1])

        const prevJointAngleL = seg.pt.angleTo(prevSegJointInfo.tangentPtsL[1])
        const nextJointAngleL = seg.pt.angleTo(nextSegJointInfo.tangentPtsL[0])
        const angleDiffL = prevJointAngleL - nextJointAngleL // smallestSignedAngleDiff(prevJointAngleL, nextJointAngleL)

        const prevJointAngleR = seg.pt.angleTo(prevSegJointInfo.tangentPtsR[1])
        const nextJointAngleR = seg.pt.angleTo(nextSegJointInfo.tangentPtsR[0])
        const angleDiffR = prevJointAngleR - nextJointAngleR // smallestSignedAngleDiff(prevJointAngleR, nextJointAngleR)

        this.sketch.ctx.beginPath()
        this.sketch.ctx.moveTo(...seg.pt.toArray())
        this.sketch.ctx.lineTo(...prevSegJointInfo.tangentPtsL[1].toArray())
        this.sketch.ctx.stroke({ debug: true, debugColor: 'blue' })
        this.sketch.ctx.beginPath()
        this.sketch.ctx.moveTo(...seg.pt.toArray())
        this.sketch.ctx.lineTo(...nextSegJointInfo.tangentPtsL[0].toArray())
        this.sketch.ctx.stroke({ debug: true, debugColor: 'aqua' })
        this.sketch.ctx.beginPath()
        this.sketch.ctx.moveTo(...seg.pt.toArray())
        this.sketch.ctx.lineTo(...prevSegJointInfo.tangentPtsR[1].toArray())
        this.sketch.ctx.stroke({ debug: true, debugColor: 'purple' })
        this.sketch.ctx.beginPath()
        this.sketch.ctx.moveTo(...seg.pt.toArray())
        this.sketch.ctx.lineTo(...nextSegJointInfo.tangentPtsR[0].toArray())
        this.sketch.ctx.stroke({ debug: true, debugColor: 'pink' })

        const H = (x: number) => (x < 0 ? -1 : 1)

        const prevRange = [prevJointAngleL, prevJointAngleR]
        const nextRange = [nextJointAngleL, nextJointAngleR]

        // https://stackoverflow.com/a/20881364/13326984
        const S =
          (nextRange[0] - prevRange[1]) *
          (nextRange[1] - prevRange[0]) *
          H(prevRange[1] - prevRange[0]) *
          H(nextRange[1] - nextRange[0])
        const leftOverlaps = S > 0
        // S = (b0 - a1) * (b1 - a0)
        // S = (b0-a1)*(b1-a0)*H(a1-a0)*H(b1-b0)

        const pointsL = [
          prevSegJointInfo.midPtL,
          nextSegJointInfo.midPtL,
          prevSegJointInfo.tangentPtsL[0],
          nextSegJointInfo.tangentPtsL[1],
        ]
        const pointsR = [
          prevSegJointInfo.midPt,
          nextSegJointInfo.midPt,
          prevSegJointInfo.tangentPtsR[0],
          nextSegJointInfo.tangentPtsR[1],
        ]
        seg.jointMidPtL = getMidPt(...pointsL)
        seg.jointMidPtR = getMidPt(...pointsR)

        // if combined joint average sits outside the current segment, we have a problem
        // it means the joins between prev and next segment overlap in some way
        if (/*!pointInCircle(seg.jointMidPtL, seg.pt, seg.radius)*/ angleDiffL > 0) {
          debugDot(this.ctx, seg.jointMidPtL, 'magenta')
          seg.overlappedCW = true

          // if (debug) {
          //   this.ctx.beginPath()
          //   pointsL.forEach((pt) => {
          //     this.ctx.moveTo(...seg.jointMidPtL.toArray())
          //     this.ctx.lineTo(...pt.toArray())
          //   })
          //   this.ctx.stroke({ debug: true, debugColor: 'magenta' })
          // }
        }

        // now we do the above but in reverse
        // if combined joint average sits outside the current segment, we have a problem
        // it means the joins between prev and next segment overlap in some way
        if (/*!pointInCircle(seg.jointMidPtR, seg.pt, seg.radius)*/ angleDiffR > 0) {
          debugDot(this.ctx, seg.jointMidPtR, 'lime')
          seg.overlappedCCW = true

          // if (debug) {
          //   this.ctx.beginPath()
          //   pointsR.forEach((pt) => {
          //     this.ctx.moveTo(...seg.jointMidPtR.toArray())
          //     this.ctx.lineTo(...pt.toArray())
          //   })
          //   this.ctx.stroke({ debug: true, debugColor: 'lime' })
          // }
        }

        if (debug) {
          // this.sketch.ctx.beginPath()
          // this.sketch.ctx.moveTo(...seg.pt.toArray())
          // this.sketch.ctx.lineTo(
          //   ...seg.pt.clone().moveAlongAngle(seg2tan2angle1, seg.radius).toArray()
          // )
          // this.sketch.ctx.moveTo(...seg.pt.toArray())
          // this.sketch.ctx.lineTo(
          //   ...seg.pt.clone().moveAlongAngle(seg2tan2angle2, seg.radius).toArray()
          // )
          // this.sketch.ctx.stroke({ debug: true })

          debugText(
            this.ctx,
            [
              //
              `#${i}`,
              `S: ${S}`,
              // `prevJointAngleL: ${radToDeg(prevJointAngleL).toFixed(2)}°`,
              // `nextJointAngleL: ${radToDeg(nextJointAngleL).toFixed(2)}°`,
              // `angleDiffL: ${radToDeg(angleDiffL).toFixed(2)}°`,
              // `prevJointAngleR: ${radToDeg(prevJointAngleR).toFixed(2)}°`,
              // `nextJointAngleR: ${radToDeg(nextJointAngleR).toFixed(2)}°`,
              // `angleDiffR: ${radToDeg(angleDiffR).toFixed(2)}°`,
            ]
              .filter(Boolean)
              .join('\n'),
            seg.pt,
            { size: 3 }
          )
        }
      }

      if (debug) {
        this.ctx.strokeCircle(prevSeg.pt, prevSeg.radius, { debug: true })
        this.ctx.strokeCircle(seg.pt, seg.radius, { debug: true })
        this.sketch.ctx.beginPath()
        this.sketch.ctx.moveTo(...prevSegJointInfo.midPtL.toArray())
        this.sketch.ctx.lineTo(...prevSegJointInfo.midPtR.toArray())
        this.sketch.ctx.stroke({ debug: true, debugColor: 'green' })

        debugDot(this.ctx, prevSegJointInfo.midPt, 'green')
        debugDot(this.ctx, prevSegJointInfo.midPtL, 'magenta')
        debugDot(this.ctx, prevSegJointInfo.midPtR, 'lime')
        debugDot(this.ctx, prevSegJointInfo.tangentPtsL[0], 'aqua')
        debugDot(this.ctx, prevSegJointInfo.tangentPtsL[1], 'blue')
        debugDot(this.ctx, prevSegJointInfo.tangentPtsR[0], 'pink')
        debugDot(this.ctx, prevSegJointInfo.tangentPtsR[1], 'purple')

        this.ctx.beginPath()
        this.ctx.moveTo(...prevSegJointInfo.midPtL.toArray())
        this.ctx.lineTo(...prevSegJointInfo.tangentPtsL[0].toArray())
        this.ctx.moveTo(...prevSegJointInfo.midPtL.toArray())
        this.ctx.lineTo(...prevSegJointInfo.tangentPtsL[1].toArray())
        this.ctx.moveTo(...prevSegJointInfo.midPtR.toArray())
        this.ctx.lineTo(...prevSegJointInfo.tangentPtsR[0].toArray())
        this.ctx.moveTo(...prevSegJointInfo.midPtR.toArray())
        this.ctx.lineTo(...prevSegJointInfo.tangentPtsR[1].toArray())

        this.ctx.moveTo(...prevSeg.pt.toArray())
        this.ctx.lineTo(
          ...prevSeg.pt
            .clone()
            .moveTowards(seg.pt, prevSeg.radius / 2)
            .toArray()
        )
        this.ctx.stroke({ debug: true })
      }
    }
  }

  draw(debug = false): void {
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const seg = this.segments[i]
      const prevSeg = seg.prev

      // debugText(
      //   this.ctx,
      //   [
      //     //
      //     `#${i}`,
      //     seg.overlappedCW && 'overlappedCW',
      //     seg.overlappedCCW && 'overlappedCCW',
      //   ]
      //     .filter(Boolean)
      //     .join('\n'),
      //   seg.pt,
      //   { size: 3 }
      // )
    }
  }
}
