import * as clipperLib from 'js-angusj-clipper/web'

import Point from '../Point'
import { Sketch } from '../Sketch'
import type { Line } from '../types'
import { getLineIntersectionPoint, getLineIntersectionPoints } from '../utils/geomUtils'
import { randFloat } from '../utils/numberUtils'
import { initPen, penUp, plotBounds } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import type Osc from './tools/Osc'
import { BooleanRange } from './tools/Range'

export default class Comb extends Sketch {
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
    this.addVar('stopAfter', {
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
    this.addVar('offsetX', {
      initialValue: 1,
      min: -this.cw / 2,
      max: this.cw / 2,
      step: 1,
    })
    this.addVar('offsetY', {
      initialValue: 1,
      min: -this.ch / 2,
      max: this.ch / 2,
      step: 1,
    })
    this.addVar('initialMovementAngle', {
      initialValue: 0,
      min: -Math.PI,
      max: Math.PI,
      step: 0.0001,
    })
    this.addVar('initialAngle', {
      initialValue: 0,
      min: -Math.PI,
      max: Math.PI,
      step: 0.0001,
    })
    this.addVar('movementSpeed', {
      initialValue: 5,
      min: 0,
      max: 10,
      step: 0.001,
    })
    this.addVar('angularSpeed', {
      initialValue: 0.01,
      min: -0.1,
      max: 0.1,
      step: 0.0001,
    })
    this.addVar('combLength', {
      initialValue: 40,
      min: 0.1,
      max: 120,
      step: 0.1,
    })
    this.addVar('combProngs', {
      initialValue: 10,
      min: 3,
      max: 100,
      step: 1,
    })
    this.addVar('pivotRatio', {
      initialValue: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
    })
  }

  count = 0
  done = false
  movementAngle = 0
  angle = 0
  position: Point = new Point(0, 0)
  prongPts: Point[] = []
  lines: Point[][] = []

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    // seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)

    this.count = 0
    this.done = false
    this.angle = this.vars.initialAngle
    this.movementAngle = this.vars.initialMovementAngle
    this.prongPts = []
    this.lines = [...Array.from({ length: this.vars.combProngs }, () => [])]

    this.position.set(this.cw / 2 + this.vars.offsetX, this.ch / 2 + this.vars.offsetY)
  }

  draw(increment: number): void {
    const {
      speedUp,
      stopAfter,
      gutter,
      combProngs,
      combLength,
      angularSpeed,
      movementSpeed,
      pivotRatio,
    } = this.vars

    if (this.done) return

    for (let i = 0; i < speedUp; i++) {
      this.count++

      if (this.count > stopAfter) {
        this.done = true
        // this.ctx.reset()
        for (let c = 0; c < combProngs; c++) {
          this.ctx.beginPath()
          this.ctx.strokePath(this.lines[c])
        }
        penUp(this)
        break
      }

      this.angle += angularSpeed
      this.position.x += Math.cos(this.movementAngle) * movementSpeed
      this.position.y += Math.sin(this.movementAngle) * movementSpeed

      let combPt = new Point(
        this.position.x + Math.cos(this.angle - Math.PI) * (combLength * pivotRatio),
        this.position.y + Math.sin(this.angle - Math.PI) * (combLength * pivotRatio)
      )
      // const combStart = combPt.clone()
      const prongPts: Point[] = []
      prongPts.push(combPt.clone())
      this.lines[0].push(combPt.clone())
      for (let c = 1; c < combProngs; c++) {
        combPt = combPt.moveAlongAngle(this.angle, combLength / combProngs)
        prongPts.push(combPt.clone())
        this.lines[c].push(combPt.clone())
      }
      // const combEnd = combPt.clone()
      // this.ctx.strokeLine(combStart, combEnd)

      // if (this.prongPts.length > 0) {
      //   for (let c = 0; c < prongPts.length; c++) {
      //     const prongLine: Line = [this.prongPts[c], prongPts[c]]
      //     this.ctx.strokeLine(...prongLine)
      //   }
      // }

      this.prongPts = prongPts
    }
  }
}
