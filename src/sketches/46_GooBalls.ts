import { deg360 } from '../constants/angles'
import Point from '../Point'
import { Sketch } from '../Sketch'
import { Line } from '../types'
import { debugDot, debugText } from '../utils/debugUtils'
import {
  circleOverlapsCircles,
  getMidPt,
  getTangentsToCircle,
  isInBounds,
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

export default class GooBalls extends Sketch {
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
      initialValue: 1728, // 2586, // 2286, //1193,
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
  jointMidPtCW?: Point
  jointMidPtCCW?: Point
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
      while (
        (!isInBounds(pt, [0, sketch.cw, sketch.ch, 0], gutter + this.radius) ||
          circleOverlapsCircles(
            [pt, this.radius],
            ...allPrev.map((seg) => [seg.pt, seg.radius] satisfies [Point, number])
          ) ||
          (hasPrevPrev &&
            !isInitialPt &&
            Math.abs(smallestSignedAngleDiff(prevPrevAngle, prev.pt.angleTo(pt))) >
              maxAngleDiff)) &&
        ++panik < 2000
      ) {
        isInitialPt = false
        const angle = randFloatRange(deg360)
        const dist = randFloatRange(
          prev.radius + this.radius + maxGap,
          prev.radius + this.radius + minGap
        )
        pt = prev.pt.clone().add(new Point(Math.cos(angle) * dist, Math.sin(angle) * dist))
        this.radius = randFloatRange(minRadius, maxRadius)
      }
      this.pt = pt
      this.prev = prev
      this.prevJointInfo = this.getJointInfo(prev)

      const angleDiff = Math.abs(smallestSignedAngleDiff(prevPrevAngle, prev.pt.angleTo(pt)))
      if (sketch.vs.showDebug.value)
        debugText(
          sketch.ctx,
          [
            `#${index}`,
            ...(hasPrevPrev
              ? [
                  `pp∠: ${radToDeg(prevPrevAngle).toFixed(2)}°`,
                  `p∠: ${radToDeg(prev.pt.angleTo(pt)).toFixed()}°`,
                  `diff: ${radToDeg(angleDiff).toFixed(2)}°`,
                  // `minDiff: ${radToDeg(maxAngleDiff).toFixed(2)}°`,
                ]
              : []),
          ].join('\n'),
          this.pt,
          { size: 3 }
        )
    } else {
      this.pt = new Point(
        gutter + this.radius + randFloatRange(sketch.cw - (gutter + this.radius) * 2),
        gutter + this.radius + randFloatRange(sketch.ch - (gutter + this.radius) * 2)
      )

      if (sketch.vs.showDebug.value) debugText(sketch.ctx, `#0`, this.pt)
    }
  }

  getJointInfo(otherSeg: Segment) {
    const gapDist = this.pt.distanceTo(otherSeg.pt) - (this.radius + otherSeg.radius)
    const midPt = this.pt.clone().moveTowards(otherSeg.pt, this.radius + gapDist / 2)

    const tangentPts1 = getTangentsToCircle(midPt, this.pt, this.radius)
    const tangentPts2 = getTangentsToCircle(midPt, otherSeg.pt, otherSeg.radius)

    return {
      midPt,
      tangentPts1,
      tangentPts2,
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
    const { gutter, minRadius, maxRadius, minGap, maxGap, minSegments, maxSegments } = this.vars

    const numSegments = randIntRange(maxSegments, minSegments)
    this.segments = [new Segment(sketch)]
    for (let i = 1; i < numSegments; i++) {
      this.segments.push(
        new Segment(sketch, { index: i, prev: this.segments[i - 1], allPrev: this.segments })
      )
    }
  }

  draw(debug = false): void {
    for (let i = 1; i < this.segments.length; i++) {
      const prevSeg = this.segments[i - 1]
      const seg = this.segments[i]
      const nextSeg = this.segments[i + 1]

      const prevSegJointInfo = prevSeg.getJointInfo(seg)

      const isLastSegment = !nextSeg

      if (!isLastSegment) {
        // we have a segment in front and behind us
        // the first iteration of this loop will be focusing on the second segment and so will be here (if there are more than 2 segments)

        const nextSegJointInfo = seg.getJointInfo(nextSeg)

        const seg2tan2angle1 = seg.pt.angleTo(prevSegJointInfo.tangentPts2[0])
        const seg2tan2angle2 = seg.pt.angleTo(nextSegJointInfo.tangentPts1[1])

        seg.jointMidPtCW = getMidPt(
          prevSegJointInfo.midPt,
          nextSegJointInfo.midPt,
          prevSegJointInfo.tangentPts2[0],
          nextSegJointInfo.tangentPts1[1]
        )
        seg.jointMidPtCCW = getMidPt(
          prevSegJointInfo.midPt,
          nextSegJointInfo.midPt,
          prevSegJointInfo.tangentPts2[1],
          nextSegJointInfo.tangentPts1[0]
        )

        // if combined joint average sits outside the current segment, we have a problem
        // it means the joins between prev and next segment overlap in some way
        if (!pointInCircle(seg.jointMidPtCW, seg.pt, seg.radius)) {
          debugDot(this.ctx, seg.jointMidPtCW, 'red')
          seg.overlappedCW = true

          if (prevSeg.prev?.overlappedCCW) {
            const startPt = prevSegJointInfo.tangentPts1[1]
            const ctrlPt1 = prevSegJointInfo.midPt
            const ctrlPt2 = nextSegJointInfo.midPt
            const endPt = nextSegJointInfo.tangentPts2[0]
            debugDot(this.ctx, startPt, 'yellow')
            debugDot(this.ctx, ctrlPt1, 'grey')
            debugDot(this.ctx, ctrlPt2, 'black')
            debugDot(this.ctx, endPt, 'orange')
            this.ctx.beginPath()
            this.ctx.moveTo(...startPt.toArray())
            // this.ctx.lineTo(...endPt.toArray())
            this.ctx.bezierCurveTo(...ctrlPt1.toArray(), ...ctrlPt2.toArray(), ...endPt.toArray())
            this.ctx.stroke()
          } else if (!prevSeg.overlappedCCW) {
            // this is okay though, we can just draw a curve from prev circle to next
            this.ctx.beginPath()
            this.ctx.moveTo(...prevSegJointInfo.tangentPts1[1].toArray())
            this.ctx.bezierCurveTo(
              ...prevSegJointInfo.midPt.toArray(),
              ...nextSegJointInfo.midPt.toArray(),
              ...nextSegJointInfo.tangentPts2[0].toArray()
            )
            this.ctx.stroke()
          }
        } else {
          // if prev segment is first one then close it up
          if (!prevSeg.prev) {
            this.ctx.stroke()
            this.ctx.beginPath()
            this.ctx.arc(
              ...prevSeg.pt.toArray(),
              prevSeg.radius,
              prevSeg.pt.angleTo(prevSegJointInfo.tangentPts1[1]),
              prevSeg.pt.angleTo(prevSegJointInfo.tangentPts1[0]),
              true
            )
            this.ctx.stroke()
          }
        }

        // now we do the above but in reverse

        // if combined joint average sits outside the current segment, we have a problem
        // it means the joins between prev and next segment overlap in some way
        if (!pointInCircle(seg.jointMidPtCCW, seg.pt, seg.radius)) {
          debugDot(this.ctx, seg.jointMidPtCCW, 'lime')
          seg.overlappedCCW = true

          if (prevSeg.prev?.overlappedCW) {
            const startPt = prevSeg.prevJointInfo.tangentPts2[0]
            const ctrlPt1 = prevSeg.prevJointInfo.midPt
            const ctrlPt2 = nextSegJointInfo.midPt
            const endPt = nextSegJointInfo.tangentPts2[1]
            // debugDot(this.ctx, startPt, 'yellow')
            // debugDot(this.ctx, ctrlPt1, 'grey')
            // debugDot(this.ctx, ctrlPt2, 'black')
            // debugDot(this.ctx, endPt, 'orange')
            this.ctx.beginPath()
            this.ctx.moveTo(...startPt.toArray())
            this.ctx.bezierCurveTo(...ctrlPt1.toArray(), ...ctrlPt2.toArray(), ...endPt.toArray())
            this.ctx.stroke()
          } else if (!prevSeg.overlappedCW) {
            // this is okay though, we can just draw a curve from prev circle to next
            this.ctx.beginPath()
            this.ctx.moveTo(...prevSegJointInfo.tangentPts1[0].toArray())
            this.ctx.bezierCurveTo(
              ...prevSegJointInfo.midPt.toArray(),
              ...nextSegJointInfo.midPt.toArray(),
              ...nextSegJointInfo.tangentPts2[1].toArray()
            )
            this.ctx.stroke()
          }
        } else {
          // if prev segment is first one then close it up
          if (!prevSeg.prev) {
            this.ctx.beginPath()
            this.ctx.arc(
              ...prevSeg.pt.toArray(),
              prevSeg.radius,
              prevSeg.pt.angleTo(prevSegJointInfo.tangentPts1[0]),
              prevSeg.pt.angleTo(prevSegJointInfo.tangentPts1[1]),
              false
            )
            this.ctx.stroke()
          }
        }

        if (debug) {
          this.sketch.ctx.beginPath()
          this.sketch.ctx.moveTo(...seg.pt.toArray())
          this.sketch.ctx.lineTo(
            ...seg.pt.clone().moveAlongAngle(seg2tan2angle1, seg.radius).toArray()
          )
          this.sketch.ctx.moveTo(...seg.pt.toArray())
          this.sketch.ctx.lineTo(
            ...seg.pt.clone().moveAlongAngle(seg2tan2angle2, seg.radius).toArray()
          )
          this.sketch.ctx.stroke({ debug: true })
        }
      }

      if (!prevSeg.overlappedCCW && prevSeg.prevJointInfo) {
        this.ctx.beginPath()
        this.ctx.moveTo(...prevSegJointInfo.tangentPts1[0].toArray())
        // this.ctx.lineTo(...prevSeg.prevJointInfo.tangentPts1[1].toArray())
        this.ctx.arc(
          ...prevSeg.pt.toArray(),
          prevSeg.radius,
          prevSeg.pt.angleTo(prevSegJointInfo.tangentPts1[0]),
          prevSeg.pt.angleTo(prevSeg.prevJointInfo.tangentPts1[1]),
          false
        )
        this.ctx.stroke()
      }

      if (!seg.overlappedCW && !prevSeg.overlappedCW) {
        this.ctx.beginPath()
        this.ctx.moveTo(...prevSegJointInfo.tangentPts1[1].toArray())
        this.ctx.bezierCurveTo(
          ...prevSegJointInfo.midPt.toArray(),
          ...prevSegJointInfo.midPt.toArray(),
          ...prevSegJointInfo.tangentPts2[0].toArray()
        )
        this.ctx.stroke()
      }

      if (!prevSeg.overlappedCW && prevSeg.prevJointInfo) {
        this.ctx.beginPath()
        this.ctx.moveTo(...prevSegJointInfo.tangentPts1[1].toArray())
        this.ctx.arc(
          ...prevSeg.pt.toArray(),
          prevSeg.radius,
          prevSeg.pt.angleTo(prevSegJointInfo.tangentPts1[1]),
          prevSeg.pt.angleTo(prevSeg.prevJointInfo.tangentPts1[0]),
          true
        )
        this.ctx.stroke()
      }
      if (!seg.overlappedCCW && !prevSeg.overlappedCCW) {
        this.ctx.beginPath()
        this.ctx.moveTo(...prevSegJointInfo.tangentPts1[0].toArray())
        this.ctx.bezierCurveTo(
          ...prevSegJointInfo.midPt.toArray(),
          ...prevSegJointInfo.midPt.toArray(),
          ...prevSegJointInfo.tangentPts2[1].toArray()
        )
        this.ctx.stroke()
      }

      // we no longer have a segment in front of us - we are the last segment
      if (isLastSegment) {
        // again there is no next segment so close the current one
        this.ctx.beginPath()
        this.ctx.arc(
          ...seg.pt.toArray(),
          seg.radius,
          seg.pt.angleTo(prevSegJointInfo.tangentPts2[0]),
          seg.pt.angleTo(prevSegJointInfo.tangentPts2[1]),
          false
        )
        this.ctx.stroke()

        // we're the last segment but also there are only 2 so close the prev one
        if (!prevSeg.prev) {
          this.ctx.beginPath()
          this.ctx.arc(
            ...prevSeg.pt.toArray(),
            prevSeg.radius,
            prevSeg.pt.angleTo(prevSegJointInfo.tangentPts1[1]),
            prevSeg.pt.angleTo(prevSegJointInfo.tangentPts1[0]),
            true
          )
          this.ctx.stroke()
        }
      }

      if (debug) {
        this.ctx.strokeCircle(prevSeg.pt, prevSeg.radius, { debug: true })
        this.ctx.strokeCircle(seg.pt, seg.radius, { debug: true })
        debugDot(this.ctx, prevSegJointInfo.midPt, 'green')
        debugDot(this.ctx, prevSegJointInfo.tangentPts1[0], 'pink')
        debugDot(this.ctx, prevSegJointInfo.tangentPts1[1], 'aqua')
        debugDot(this.ctx, prevSegJointInfo.tangentPts2[0], 'blue')
        debugDot(this.ctx, prevSegJointInfo.tangentPts2[1], 'purple')

        this.ctx.beginPath()
        this.ctx.moveTo(...prevSegJointInfo.midPt.toArray())
        this.ctx.lineTo(...prevSegJointInfo.tangentPts1[0].toArray())
        this.ctx.moveTo(...prevSegJointInfo.midPt.toArray())
        this.ctx.lineTo(...prevSegJointInfo.tangentPts1[1].toArray())
        this.ctx.moveTo(...prevSegJointInfo.midPt.toArray())
        this.ctx.lineTo(...prevSegJointInfo.tangentPts2[0].toArray())
        this.ctx.moveTo(...prevSegJointInfo.midPt.toArray())
        this.ctx.lineTo(...prevSegJointInfo.tangentPts2[1].toArray())

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
}
