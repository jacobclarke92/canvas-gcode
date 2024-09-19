import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import { circleOverlapsCircles, getTangentsToCircle, isInBounds } from '../utils/geomUtils'
import { seedNoise } from '../utils/noise'
import { randFloatRange, randIntRange } from '../utils/numberUtils'
import { initPen, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'

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
      initialValue: 1193,
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
      initialValue: 50,
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
      initialValue: 50,
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
      initialValue: 5,
      min: 2,
      max: 12,
      step: 1,
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
    creature.draw(true)
  }

  draw(increment: number): void {
    //
  }
}

class Segment {
  pt: Point
  radius: number
  prev?: Segment

  constructor(sketch: Sketch, notFirst?: { prev: Segment; allPrev: Segment[] }) {
    const { gutter, minRadius, maxRadius, minGap, maxGap } = sketch.vars
    this.radius = randFloatRange(minRadius, maxRadius)
    if (notFirst) {
      const { prev, allPrev } = notFirst
      let pt = new Point(-1, -1)
      let panik = 0
      while (
        (!isInBounds(pt, [0, sketch.cw, sketch.ch, 0], gutter + this.radius) ||
          circleOverlapsCircles(
            [pt, this.radius],
            ...allPrev.map((seg) => [seg.pt, seg.radius] satisfies [Point, number])
          )) &&
        ++panik < 100
      ) {
        const angle = randFloatRange(Math.PI * 2)
        const dist = randFloatRange(
          prev.radius + this.radius + maxGap,
          prev.radius + this.radius + minGap
        )
        pt = prev.pt.clone().add(new Point(Math.cos(angle) * dist, Math.sin(angle) * dist))
      }
      this.pt = pt
    } else {
      this.pt = new Point(
        gutter + this.radius + randFloatRange(sketch.cw - (gutter + this.radius) * 2),
        gutter + this.radius + randFloatRange(sketch.ch - (gutter + this.radius) * 2)
      )
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
        new Segment(sketch, { prev: this.segments[i - 1], allPrev: this.segments })
      )
    }
  }

  draw(debug = false): void {
    for (let i = 1; i < this.segments.length; i++) {
      const seg1 = this.segments[i - 1]
      const seg2 = this.segments[i]
      const seg3 = this.segments[i + 1]

      const { midPt, tangentPts1, tangentPts2 } = seg1.getJointInfo(seg2)

      const tan1overlaps = false
      let tan2overlaps = false
      if (seg3) {
        const jointInfo = seg2.getJointInfo(seg3)
        // TODO: detect if joints would overlap and adjust bezier accordingly to skip the midpoint of seg 1 and 2 and find a better midpoint between seg 0 and 2
        const seg2tan2angle1 = seg2.pt.angleTo(tangentPts2[0])
        const seg2tan2angle2 = seg2.pt.angleTo(jointInfo.tangentPts1[1])

        if (seg2tan2angle2 < seg2tan2angle1) {
          tan2overlaps = true
        }

        if (debug) {
          this.sketch.ctx.beginPath()
          this.sketch.ctx.moveTo(...seg2.pt.toArray())
          this.sketch.ctx.lineTo(
            ...seg2.pt.clone().moveAlongAngle(seg2tan2angle1, seg2.radius).toArray()
          )
          this.sketch.ctx.moveTo(...seg2.pt.toArray())
          this.sketch.ctx.lineTo(
            ...seg2.pt.clone().moveAlongAngle(seg2tan2angle2, seg2.radius).toArray()
          )
          this.sketch.ctx.stroke({ debug: true })
        }
      }

      this.ctx.beginPath()
      this.ctx.arc(
        seg1.pt.x,
        seg1.pt.y,
        seg1.radius,
        seg1.pt.angleTo(tangentPts1[0]),
        seg1.pt.angleTo(tangentPts1[1]),
        false
      )
      this.ctx.stroke()

      this.ctx.beginPath()
      this.ctx.arc(
        seg2.pt.x,
        seg2.pt.y,
        seg2.radius,
        seg2.pt.angleTo(tangentPts2[0]),
        seg2.pt.angleTo(tangentPts2[1]),
        false
      )
      this.ctx.stroke()

      if (debug) {
        this.ctx.strokeCircle(seg1.pt, seg1.radius, { debug: true })
        this.ctx.strokeCircle(seg2.pt, seg2.radius, { debug: true })
        debugDot(this.ctx, midPt, 'green')
        debugDot(this.ctx, tangentPts1[0], 'pink')
        debugDot(this.ctx, tangentPts1[1], tan2overlaps ? 'red' : 'aqua')
        debugDot(this.ctx, tangentPts2[0], tan2overlaps ? 'red' : 'blue')
        debugDot(this.ctx, tangentPts2[1], 'purple')
        this.ctx.beginPath()
        this.ctx.moveTo(...midPt.toArray())
        this.ctx.lineTo(...tangentPts1[0].toArray())
        this.ctx.moveTo(...midPt.toArray())
        this.ctx.lineTo(...tangentPts1[1].toArray())
        this.ctx.moveTo(...midPt.toArray())
        this.ctx.lineTo(...tangentPts2[0].toArray())
        this.ctx.moveTo(...midPt.toArray())
        this.ctx.lineTo(...tangentPts2[1].toArray())
        this.ctx.moveTo(...seg1.pt.toArray())
        this.ctx.lineTo(
          ...seg1.pt
            .clone()
            .moveTowards(seg2.pt, seg1.radius / 2)
            .toArray()
        )
        this.ctx.stroke({ debug: true })
      }

      this.ctx.beginPath()
      this.ctx.moveTo(...tangentPts1[0].toArray())
      this.ctx.bezierCurveTo(midPt.x, midPt.y, midPt.x, midPt.y, tangentPts2[1].x, tangentPts2[1].y)
      this.ctx.moveTo(...tangentPts1[1].toArray())
      this.ctx.bezierCurveTo(midPt.x, midPt.y, midPt.x, midPt.y, tangentPts2[0].x, tangentPts2[0].y)
      this.ctx.stroke()
    }
  }
}
