import { deg20, deg90, deg360 } from '../constants/angles'
import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import { debugDot, debugText } from '../utils/debugUtils'
import {
  arcsOverlap,
  circleOverlapsCircles,
  getTangentsToCircle,
  isInBounds,
  lineIntersectsWithAny,
  pointInCircle,
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
      initialValue: 2735, //1754, // 1620, // 1728, // 2586, // 2286, //1193,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.addVar('gutter', {
      initialValue: 8,
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
      initialValue: 1.8,
      min: 0,
      max: 25,
      step: 0.1,
    })
    // this.addVar('minSegments', {
    //   initialValue: 6,
    //   min: 2,
    //   max: 12,
    //   step: 1,
    // })
    // this.addVar('maxSegments', {
    //   initialValue: 6,
    //   min: 2,
    //   max: 12,
    //   step: 1,
    // })
    this.addVar('numSegments', {
      initialValue: 4,
      min: 2,
      max: 12,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('maxAngleDiff', {
      initialValue: 0.8, //Math.PI,
      min: 0,
      max: Math.PI,
      step: 0.01,
      disableRandomize: true,
    })

    this.addVar('hairDensity', {
      initialValue: 0.15,
      min: 0.035,
      max: 0.5,
      step: 0.001,
      disableRandomize: true,
    })
    this.addVar('hairInverseSpace', {
      initialValue: 140,
      min: 10,
      max: 250,
      step: 1,
      disableRandomize: true,
    })
    this.addVar('maxHairLength', {
      initialValue: 0.15,
      min: 0,
      max: 0.6,
      step: 0.01,
    })
    this.addVar('hairSway', {
      initialValue: 0.25,
      min: 0,
      max: 1.5,
      step: 0.001,
    })
    this.addVar('hairLoss', {
      initialValue: 0,
      min: 0,
      max: 1,
      step: 0.001,
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
  overlappedR = false
  overlappedL = false

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
          const angle = randFloatRange(deg360)
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
    const midPtL = midPt.clone().moveAlongAngle(angle - deg90, adhesion)
    const midPtR = midPt.clone().moveAlongAngle(angle + deg90, adhesion)

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
    const {
      gutter,
      minRadius,
      maxRadius,
      minGap,
      maxGap,
      adhesion,
      numSegments,
      minSegments,
      maxSegments,
    } = this.vars

    // const numSegments = randIntRange(maxSegments, minSegments)
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

        const prevJointAngleL = seg.pt.angleTo(prevSegJointInfo.tangentPtsL[1])
        const nextJointAngleL = seg.pt.angleTo(nextSegJointInfo.tangentPtsL[0])

        const prevJointAngleR = seg.pt.angleTo(prevSegJointInfo.tangentPtsR[1])
        const nextJointAngleR = seg.pt.angleTo(nextSegJointInfo.tangentPtsR[0])

        const overlapResult = arcsOverlap(
          [prevJointAngleR, prevJointAngleL],
          [nextJointAngleL, nextJointAngleR]
        )

        if (overlapResult.overlaps && overlapResult.skew === 'right') {
          // debugDot(this.ctx, seg.jointMidPtL, 'magenta')
          seg.overlappedR = true
        }
        if (overlapResult.overlaps && overlapResult.skew === 'left') {
          // debugDot(this.ctx, seg.jointMidPtR, 'lime')
          seg.overlappedL = true
        }

        if (debug) {
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

          debugText(
            this.ctx,
            [
              //
              `#${i}`,
              `overlaps: ${overlapResult.overlaps ? 'yes' : 'no'}`,
              overlapResult.skew && `overlapSkew: ${overlapResult.skew}`,
              // `prevJointAngleL: ${prevJointAngleL.toFixed(2)}°`,
              // `prevJointAngleR: ${prevJointAngleR.toFixed(2)}°`,
              // `nextJointAngleL: ${nextJointAngleL.toFixed(2)}°`,
              // `nextJointAngleR: ${nextJointAngleR.toFixed(2)}°`,
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
    // eslint-disable-next-line prefer-const
    let dir: 'L' | 'R' = 'R'
    // eslint-disable-next-line prefer-const
    let bezierStartPt: Point | false = false
    // eslint-disable-next-line prefer-const
    let bezierCtrlPt1: Point | false = false
    // eslint-disable-next-line prefer-const
    let bezierCtrlPt2: Point | false = false

    this.ctx.beginPath()
    for (let i = 1; dir === 'R' ? i < this.segments.length : i > 0; dir === 'R' ? i++ : i--) {
      const seg = this.segments[i]
      const next = this.segments[i + 1]
      if (dir === 'R' && i === 1) {
        this.ctx.arc(
          ...seg.prev.pt.toArray(),
          seg.prev.radius,
          seg.prev.pt.angleTo(seg.prevJointInfo.tangentPtsL[1]),
          seg.prev.pt.angleTo(seg.prevJointInfo.tangentPtsR[1]),
          false
        )
        // this.ctx.moveTo(...seg.prevJointInfo.tangentPtsR[1].toArray())
      }

      if (!bezierStartPt) {
        if (dir === 'R' && !seg.prev[`overlapped${dir}`]) {
          bezierStartPt = seg.prevJointInfo[`tangentPts${dir}`][dir === 'R' ? 1 : 0]
          // debugDot(this.ctx, bezierStartPt, 'black')
          bezierCtrlPt1 = seg.prevJointInfo[`midPt${dir}`]
        } else if (dir === 'L' && (!next || !seg[`overlapped${dir}`])) {
          bezierStartPt = seg.prevJointInfo[`tangentPts${dir}`][0]
          // debugDot(this.ctx, bezierStartPt, 'black')
          bezierCtrlPt1 = seg.prevJointInfo[`midPt${dir}`]
        }
      } else {
        bezierCtrlPt2 = seg.prevJointInfo[`midPt${dir}`]
      }

      if ((!next || !seg[`overlapped${dir}`]) && bezierStartPt) {
        const bezierEndPt = seg.prevJointInfo[`tangentPts${dir}`][dir === 'R' ? 0 : 1]
        if (!bezierCtrlPt2) bezierCtrlPt2 = bezierCtrlPt1

        // this.ctx.moveTo(...bezierStartPt.toArray())
        // this.ctx.lineTo(...(bezierCtrlPt1 as Point).toArray())
        // this.ctx.lineTo(...bezierCtrlPt2.toArray())
        // this.ctx.lineTo(...bezierEndPt.toArray())
        // this.ctx.stroke({ debug: true })

        this.ctx.moveTo(...bezierStartPt.toArray())
        this.ctx.bezierCurveTo(
          ...(bezierCtrlPt1 as Point).toArray(),
          ...(bezierCtrlPt2 as Point).toArray(),
          ...bezierEndPt.toArray()
        )
        bezierStartPt = false
        bezierCtrlPt1 = false
        bezierCtrlPt2 = false
      }

      if (next) {
        if (dir === 'R') {
          if (!seg[`overlapped${dir}`] /*&& !seg.prev[`overlapped${dir}`]*/) {
            this.ctx.moveTo(...seg.prevJointInfo[`tangentPts${dir}`][0].toArray())
            this.ctx.arc(
              ...seg.pt.toArray(),
              seg.radius,
              seg.pt.angleTo(seg.prevJointInfo[`tangentPts${dir}`][0]),
              seg.pt.angleTo(next.prevJointInfo[`tangentPts${dir}`][1]),
              false
            )
          }
        } else {
          if (!seg[`overlapped${dir}`] /* && !next[`overlapped${dir}`]*/) {
            this.ctx.moveTo(...next.prevJointInfo[`tangentPts${dir}`][1].toArray())
            this.ctx.arc(
              ...seg.pt.toArray(),
              seg.radius,
              seg.pt.angleTo(next.prevJointInfo[`tangentPts${dir}`][1]),
              seg.pt.angleTo(seg.prevJointInfo[`tangentPts${dir}`][0]),
              false
            )
          }
        }
      }

      // close last one before turning around
      if (!next && dir === 'R') {
        this.ctx.arc(
          ...seg.pt.toArray(),
          seg.radius,
          seg.pt.angleTo(seg.prevJointInfo.tangentPtsR[0]),
          seg.pt.angleTo(seg.prevJointInfo.tangentPtsL[0]),
          false
        )
        i++
        dir = 'L'
      }

      //
    }
    this.ctx.stroke()

    // draw eyes
    const firstJointAngle = this.segments[1].pt.angleTo(this.segments[0].pt)
    const eyeSize = this.segments[0].radius * 0.2
    const eyeGap = deg20
    const eyePos1 = this.segments[0].pt
      .clone()
      .moveAlongAngle(firstJointAngle + eyeGap, this.segments[0].radius * 0.7)
    const eyePos2 = this.segments[0].pt
      .clone()
      .moveAlongAngle(firstJointAngle - eyeGap, this.segments[0].radius * 0.7)
    const pupilPos1 = eyePos1
      .clone()
      .moveAlongAngle(randFloatRange(deg360), randFloatRange(eyeSize / 2))
    const pupilPos2 = eyePos2
      .clone()
      .moveAlongAngle(randFloatRange(deg360), randFloatRange(eyeSize / 2))

    this.ctx.strokeCircle(eyePos1, eyeSize)
    this.ctx.strokeCircle(eyePos2, eyeSize)
    for (let i = 4; i <= 10; i += 2) {
      this.ctx.strokeCircle(pupilPos1, eyeSize / i)
      this.ctx.strokeCircle(pupilPos2, eyeSize / i)
    }

    // draw hairs
    for (let i = 1; i < this.segments.length; i++) {
      const seg = this.segments[i]

      if (i === this.segments.length - 1) {
        const startAnglePt = seg.prevJointInfo.tangentPtsR[0]
        const endAnglePt = seg.prevJointInfo.tangentPtsL[0]
        this.drawHairs(seg, seg.pt.angleTo(startAnglePt), seg.pt.angleTo(endAnglePt), {
          useLargerAngle: true,
        })
      } else {
        const next = this.segments[i + 1]
        if (!seg.overlappedL) {
          const startAnglePt = seg.prevJointInfo.tangentPtsL[0]
          const endAnglePt = next.prevJointInfo.tangentPtsL[1]
          this.drawHairs(seg, seg.pt.angleTo(startAnglePt), seg.pt.angleTo(endAnglePt), {
            reverseDirection: true,
          })
        }
        if (!seg.overlappedR) {
          const startAnglePt = seg.prevJointInfo.tangentPtsR[0]
          const endAnglePt = next.prevJointInfo.tangentPtsR[1]
          this.drawHairs(seg, seg.pt.angleTo(startAnglePt), seg.pt.angleTo(endAnglePt))
        }
      }
    }
  }

  drawHairs(
    seg: Segment,
    startAngle: number,
    endAngle: number,
    opts?: { useLargerAngle?: boolean; reverseDirection?: boolean }
  ) {
    const { hairDensity, hairInverseSpace, maxHairLength, hairSway, hairLoss } = this.vars

    let angleRange = Math.abs(smallestSignedAngleDiff(startAngle, endAngle))
    if (opts?.useLargerAngle) angleRange = deg360 - angleRange
    const hairCount = Math.ceil(
      ((angleRange / hairDensity) * (hairInverseSpace - seg.radius)) / hairInverseSpace
    )
    const angleSegment = angleRange / hairCount

    for (let h = 0; h < hairCount + 1; h++) {
      if (randFloatRange(1) < hairLoss) continue
      const hairLength =
        seg.radius * maxHairLength +
        randFloatRange((seg.radius * maxHairLength) / 2, (-seg.radius * maxHairLength) / 2)
      const angle = startAngle + h * angleSegment * (opts?.reverseDirection ? -1 : 1)
      const hairPos = seg.pt.clone().moveAlongAngle(angle, seg.radius)
      this.ctx.moveTo(...hairPos.toArray())
      this.ctx.lineTo(
        ...hairPos
          .clone()
          .moveAlongAngle(angle + randFloatRange(hairSway, -hairSway), hairLength)
          .toArray()
      )
      this.ctx.stroke()
    }
  }
}
