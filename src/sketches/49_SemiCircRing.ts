import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import { debugDot } from '../utils/debugUtils'
import { getPointsWhereLineIntersectsCircle } from '../utils/geomUtils'
import { perlin2 } from '../utils/noise'
import { initPen, penUp, plotBounds, stopAndWigglePen } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import type Osc from './tools/Osc'
import { BooleanRange } from './tools/Range'

export default class SemiCircRing extends Sketch {
  sizeOsc: Osc
  init() {
    this.addVar('seed', {
      initialValue: 1234,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.addVar('lines', {
      initialValue: 1,
      min: 1,
      max: 200,
      step: 1,
    })
    this.addVar('twists', {
      initialValue: 4,
      min: 1,
      max: 24,
      step: 1,
    })
    this.addVar('circleRadius', {
      initialValue: 30,
      min: 1,
      max: 150,
      step: 0.5,
    })
    this.addVar('circumferenceRange', {
      initialValue: Math.PI / 2,
      min: 0,
      max: Math.PI * 2,
      step: Math.PI / 64,
    })
    this.addVar('arcRadiusModifier', {
      initialValue: 0.001,
      min: -150,
      max: 150,
      step: 0.5,
    })
  }

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    // seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)

    const { lines, circleRadius, arcRadiusModifier, circumferenceRange, twists } = this.vars

    // this.ctx.strokeCircle(new Point(this.cx, this.cy), 2)

    const theta = (Math.PI * 2) / lines
    for (let i = 0; i < lines; i++) {
      let x = this.cx
      let y = this.cy
      const outwardDirection = theta * i
      // start at 90° angle down
      let arcAngleStart = outwardDirection + Math.PI
      // debugDot(this.ctx, new Point(x, y))
      for (let t = 0; t < twists; t++) {
        this.ctx.beginPath()
        const radius = t === 0 ? circleRadius / 2 : circleRadius
        const clockwise = t % 2 === 0

        // this.ctx.moveTo(x, y)

        x += radius * Math.cos(t === 0 ? outwardDirection : arcAngleStart)
        y += radius * Math.sin(t === 0 ? outwardDirection : arcAngleStart)

        // this.ctx.lineTo(x, y)
        // this.ctx.stroke()
        // this.ctx.strokeCircle(new Point(x, y), radius)

        this.ctx.beginPath()
        const arcAngleEnd = arcAngleStart + circumferenceRange
        this.ctx.arc(
          x,
          y,
          Math.max(0, circleRadius / 2 + arcRadiusModifier),
          arcAngleStart + (t === 0 ? 0 : Math.PI),
          arcAngleEnd,
          !clockwise
        )
        arcAngleStart = arcAngleEnd
        this.ctx.stroke()
        this.ctx.closePath()
        // debugDot(this.ctx, new Point(x, y))
      }
      // this.ctx.lineTo(
      //   this.cx + circleRadius * Math.cos(theta * i),
      //   this.cy + circleRadius * Math.sin(theta * i)
      // )
    }

    penUp(this)
  }

  draw(increment: number): void {
    //
  }
}
