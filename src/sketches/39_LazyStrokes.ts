import * as clipperLib from 'js-angusj-clipper/web'

import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import { getLineIntersectionPoint, getLineIntersectionPoints } from '../utils/geomUtils'
import { initPen, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import type Osc from './tools/Osc'
import { BooleanRange } from './tools/Range'

const quarterTurn = Math.PI / 2

export default class LazyStrokes extends Sketch {
  sizeOsc: Osc
  init() {
    this.addVar('seed', {
      initialValue: 1234,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.addVar('gutter', {
      initialValue: 10,
      min: 0,
      max: 200,
      step: 1,
    })
    this.addVar('strokes', {
      initialValue: 35,
      min: 5,
      max: 200,
      step: 1,
    })
    this.addVar('amplitude', {
      initialValue: 100,
      min: 5,
      max: 500,
      step: 1,
    })
    this.addVar('angle', {
      initialValue: 0,
      min: -Math.PI,
      max: Math.PI,
      step: 0.001,
    })
    this.vs.trimToGutter = new BooleanRange({
      disableRandomize: true,
      initialValue: false,
    })
    this.vs.cutGutter = new BooleanRange({
      disableRandomize: true,
      initialValue: false,
    })
    this.addVar('trimAmplitudeFalloff', {
      initialValue: 0,
      min: 0,
      max: 10,
      step: 0.001,
    })
  }

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    // seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)

    const { gutter, strokes, angle, amplitude, trimAmplitudeFalloff } = this.vars
    const trimToGutter = !!this.vs.trimToGutter.value
    const cutGutter = !!this.vs.cutGutter.value

    const boundaryLines: Line[] = [
      [new Point(gutter, gutter), new Point(this.cw - gutter, gutter)],
      [new Point(this.cw - gutter, gutter), new Point(this.cw - gutter, this.ch - gutter)],
      [new Point(this.cw - gutter, this.ch - gutter), new Point(gutter, this.ch - gutter)],
      [new Point(gutter, this.ch - gutter), new Point(gutter, gutter)],
    ]

    // getLineIntersectionPoints

    const availableSpace = Point.distance(new Point(0, 0), new Point(this.cw, this.ch))
    const spacing = availableSpace / strokes

    for (let i = 0; i < strokes; i++) {
      const outsidePt1 = new Point(
        this.cw / 2 + Math.cos(angle) * availableSpace,
        this.ch / 2 + Math.sin(angle) * availableSpace
      )
        .moveAlongAngle(angle - quarterTurn, availableSpace / 2)
        .moveAlongAngle(angle + quarterTurn, i * spacing)
      const outsidePt2 = new Point(
        this.cw / 2 + Math.cos(angle + Math.PI) * availableSpace,
        this.ch / 2 + Math.sin(angle + Math.PI) * availableSpace
      )
        .moveAlongAngle(angle - quarterTurn, availableSpace / 2)
        .moveAlongAngle(angle + quarterTurn, i * spacing)

      if (!trimToGutter) {
        this.curvyBoi({
          pt1: outsidePt1,
          pt2: outsidePt2,
          amplitude,
        })
      } else {
        const intersectionPoints = getLineIntersectionPoints(
          [outsidePt1, outsidePt2],
          ...boundaryLines
        ).map(([pt]) => pt)

        if (intersectionPoints.length >= 2) {
          const [pt1, pt2] = intersectionPoints
          const dist = Point.distance(pt1, pt2)
          // const div = (availableSpace - dist) * trimAmplitudeFalloff
          const realAmplitude =
            dist / trimAmplitudeFalloff + (amplitude + dist) / trimAmplitudeFalloff // amplitude // / div
          this.curvyBoi({ pt1, pt2, amplitude })
        }
      }
    }

    if (cutGutter) {
      // top
      this.ctx.clearRect(-1000, -1000 + gutter, this.cw + 2000, 1000)
      this.ctx.clearRect(-1000, -1000, 1000 + gutter, this.ch + 2000)
      this.ctx.clearRect(this.cw - gutter, -1000, gutter + 1000, this.ch + 2000)
      this.ctx.clearRect(-1000, this.ch - gutter, this.cw + 2000, gutter + 1000)
    }
  }

  curvyBoi({ pt1, pt2, amplitude }: { pt1: Point; pt2: Point; amplitude: number }) {
    //
    const angle = Point.angleBetween(pt1, pt2)
    const fullDist = Point.distance(pt1, pt2)
    const length1 = fullDist * (1 / 3)
    const length2 = fullDist * (2 / 3)

    const firstMidPt = pt1.clone().moveTowards(pt2, length1)
    const secondMidPt = pt1.clone().moveTowards(pt2, length2)

    this.ctx.beginPath()
    this.ctx.moveTo(pt1.x, pt1.y)
    // (25, -25, 50, 25, 75, 0)
    this.ctx.bezierCurveTo(
      firstMidPt.x + Math.cos(angle - quarterTurn) * amplitude,
      firstMidPt.y + Math.sin(angle - quarterTurn) * -amplitude,
      secondMidPt.x + Math.cos(angle + quarterTurn) * amplitude,
      secondMidPt.y + Math.sin(angle + quarterTurn) * -amplitude,
      pt2.x,
      pt2.y
    )
    this.ctx.stroke()
    this.ctx.closePath()
  }

  draw(increment: number): void {
    //
  }
}
