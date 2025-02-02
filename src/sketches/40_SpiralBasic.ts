import * as clipperLib from 'js-angusj-clipper/web'

import { deg60 } from '../constants/angles'
import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import { getLineIntersectionPoint, getLineIntersectionPoints } from '../utils/geomUtils'
import { initPen, penUp, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import type Osc from './tools/Osc'
import { BooleanRange } from './tools/Range'

export default class SpiralBasic extends Sketch {
  sizeOsc: Osc
  init() {
    this.addVar('seed', {
      initialValue: 1234,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.addVar('speedUp', {
      initialValue: 69,
      min: 1,
      max: 200,
      step: 1,
    })
    this.addVar('gutter', {
      initialValue: 10,
      min: 0,
      max: 200,
      step: 1,
    })
    this.addVar('initialAngle', {
      initialValue: 0,
      min: 0,
      max: Math.PI,
      step: 0.0001,
    })
    this.addVar('outwardSpeed', {
      initialValue: 0.01,
      min: 0.005,
      max: 0.4,
      step: 0.001,
    })
    this.addVar('outwardSpeedOscDist', {
      initialValue: 0,
      min: 0,
      max: 5,
      step: 0.001,
    })
    this.addVar('outwardSpeedOscRate', {
      initialValue: 0.01,
      min: 0,
      max: 0.1,
      step: 0.001,
    })
    this.addVar('outwardSpeedOscOffset', {
      initialValue: 0,
      min: -Math.PI,
      max: Math.PI,
      step: 0.001,
    })
    this.addVar('angularSpeed', {
      initialValue: 0.01,
      min: 0.001,
      max: deg60,
      step: 0.0001,
    })
    this.addVar('angularSpeedOscDist', {
      initialValue: 0,
      min: 0,
      max: 0.1,
      step: 0.001,
    })
    this.addVar('angularSpeedOscRate', {
      initialValue: 0.01,
      min: 0,
      max: 0.1,
      step: 0.001,
    })
  }

  done = false
  position: Point = new Point(0, 0)
  angle = 0
  dist = 0
  osc1Angle = 0
  osc2Angle = 0

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    // seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)

    this.done = false
    this.angle = this.vars.initialAngle
    this.dist = 0
    this.osc1Angle = this.vars.outwardSpeedOscOffset
    this.osc2Angle = 0
    this.position.set(this.cw / 2, this.ch / 2)
  }

  draw(increment: number): void {
    const {
      speedUp,
      gutter,
      angularSpeed,
      outwardSpeed,
      outwardSpeedOscDist,
      outwardSpeedOscRate,
      angularSpeedOscDist,
      angularSpeedOscRate,
    } = this.vars

    if (this.done) return
    for (let i = 0; i < speedUp; i++) {
      this.osc1Angle += outwardSpeedOscRate
      this.osc2Angle += angularSpeedOscRate
      this.angle += angularSpeed
      this.angle += Math.sin(this.osc2Angle) * angularSpeedOscDist
      this.dist += outwardSpeed
      this.dist += Math.sin(this.osc1Angle) * outwardSpeedOscDist

      this.ctx.beginPath()
      this.ctx.moveTo(...this.position.toArray())

      this.position.set(
        this.cw / 2 + Math.cos(this.angle) * this.dist,
        this.ch / 2 + Math.sin(this.angle) * this.dist
      )

      this.ctx.lineTo(...this.position.toArray())
      this.ctx.stroke()

      if (
        this.position.x < gutter ||
        this.position.x > this.cw - gutter ||
        this.position.y < gutter ||
        this.position.y > this.ch - gutter
      ) {
        this.done = true
        penUp(this)
        break
      }
    }
  }
}
