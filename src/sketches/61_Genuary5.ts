import * as clipperLib from 'js-angusj-clipper/web'

import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot, debugText } from '../utils/debugUtils'
import { perlin2, seedNoise } from '../utils/noise'
import { randInt, randIntRange } from '../utils/numberUtils'
import { initPen, penUp, plotBounds, stopAndWigglePen } from '../utils/penUtils'
import { random, seedRandom } from '../utils/random'
import Range, { BooleanRange } from './tools/Range'

export default class IsometricGrid extends Sketch {
  // static generateGCode = false
  static enableCutouts = false
  static disableOverclock = true

  init() {
    this.addVar('speedUp',{ name: 'speedUp', initialValue: 10, min: 1, max: 100, step: 1, disableRandomize: true }) // prettier-ignore
    this.addVar('seed', { name: 'seed', initialValue: 1000, min: 1000, max: 5000, step: 1 })
    this.addVar('gutter', { name: 'gutter', initialValue: 10, min: 1, max: 100, step: 1 })
    this.addVar('shadeSpacing', { name: 'gutter', initialValue: 1, min: 0, max: 3, step: 0.01 })

    this.addVar('edgeLength', { name: 'edgeLength', initialValue: 23, min: 1, max: 100, step: 0.1 })
    this.addVar('verticalSeparation', {
      name: 'verticalSeparation',
      initialValue: 5,
      min: 0,
      max: 10,
      step: 0.1,
    })
    this.addVar('angle', {
      name: 'angle',
      initialValue: Math.PI / 6,
      min: Math.PI / 96,
      max: Math.PI,
      step: Math.PI / 96,
    })
  }

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)
    // isometric grid, go

    const { gutter, edgeLength, verticalSeparation, angle } = this.vars

    // const vSize = Math.sin(angle) * hSize * 2
    // a*a + verticalSeparation*verticalSeparation = edgeLength*edgeLength
    // solve for a:
    const hSize = Math.sqrt(edgeLength * edgeLength - verticalSeparation * verticalSeparation) * 2

    const maxX = Math.floor((this.cw - gutter * 2) / hSize)
    const maxY = Math.floor((this.ch - gutter * 2) / verticalSeparation)

    for (let y = 0; y < maxY; y++) {
      for (let x = 0; x < maxX; x++) {
        const pt = new Point(
          gutter + x * hSize + (y % 2 === 0 ? 0 : hSize / 2),
          gutter + y * verticalSeparation
        )
        // debugDot(this.ctx, pt)
        this.ctx.beginPath()

        if (y % 4 !== 2 && y !== 0) {
          this.ctx.moveTo(...pt.toArray())
          this.ctx.lineToRelativeAngle(-angle, edgeLength)
          // this.ctx.lineTo(pt.x + hSize / 2, pt.y - vSize)
          if (y % 4 === 1 && x === maxX - 1) {
            this.ctx.lineToRelative(0, verticalSeparation * 2)
          }
        }
        if (y % 4 !== 1 && y !== maxY - 1) {
          this.ctx.moveTo(...pt.toArray())
          // this.ctx.lineTo(pt.x + hSize / 2, pt.y + vSize)
          this.ctx.lineToRelativeAngle(angle, edgeLength)
        }
        if (y % 4 !== 2 && y % 4 !== 3) {
          this.ctx.moveTo(...pt.toArray())
          // this.ctx.lineTo(pt.x, pt.y + vSize * 2)
          // this.ctx.lineToRelative(0, vSize * 2)
          this.ctx.lineToRelative(0, verticalSeparation * 2)
        }

        this.ctx.stroke()
        // debugText(this.ctx, `${x},${y}`, pt, { size: 2 })
      }
    }
    this.shadeCell(0, 4)
  }

  shadeCell(x: number, y: number) {
    const { gutter, hSize, angle, shadeSpacing } = this.vars

    const vSize = Math.sin(angle) * hSize * 2
    const pt = new Point(gutter + x * hSize + (y % 2 === 0 ? 0 : hSize / 2), gutter + y * vSize)
    // pt.moveAlongAngle(-angle * 4, shadeSpacing)
    // pt.moveAlongAngle(angle * 4, shadeSpacing)
    pt.add(shadeSpacing, 0)
    for (let i = 0; i < 12; i++) {
      this.ctx.beginPath()
      this.ctx.moveTo(
        ...pt
          .clone()
          .moveAlongAngle(angle * 2, shadeSpacing * i)
          .toArray()
      )
      this.ctx.lineToRelative(
        (Math.cos(-angle * 2) * (hSize - shadeSpacing * 2)) / 2,
        (Math.sin(-angle * 2) * (hSize - shadeSpacing * 2)) / 2
      )
      this.ctx.stroke()
    }
  }

  draw(increment: number): void {
    //
  }
}
