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
      initialValue: 4,
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
    const { gutter, minRadius, maxRadius, minGap, maxGap, minSegments, maxSegments } = sketch.vars
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

      const gapDist = seg1.pt.distanceTo(seg2.pt) - (seg1.radius + seg2.radius)
      const midPt = seg1.pt.clone().moveTowards(seg2.pt, seg1.radius + gapDist / 2)

      const tangentPts1 = getTangentsToCircle(midPt, seg1.pt, seg1.radius)
      const tangentPts2 = getTangentsToCircle(midPt, seg2.pt, seg2.radius)

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
        debugDot(this.ctx, midPt, 'red')
        debugDot(this.ctx, tangentPts1[0], 'blue')
        debugDot(this.ctx, tangentPts1[1], 'blue')
        debugDot(this.ctx, tangentPts2[0], 'green')
        debugDot(this.ctx, tangentPts2[1], 'green')
        this.ctx.beginPath()
        this.ctx.moveTo(...midPt.toArray())
        this.ctx.lineTo(...tangentPts1[0].toArray())
        this.ctx.moveTo(...midPt.toArray())
        this.ctx.lineTo(...tangentPts1[1].toArray())
        this.ctx.moveTo(...midPt.toArray())
        this.ctx.lineTo(...tangentPts2[0].toArray())
        this.ctx.moveTo(...midPt.toArray())
        this.ctx.lineTo(...tangentPts2[1].toArray())
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
