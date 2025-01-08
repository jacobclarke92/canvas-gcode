import * as clipperLib from 'js-angusj-clipper/web'

import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot, debugText } from '../utils/debugUtils'
import { perlin2, seedNoise } from '../utils/noise'
import { randFloatRange, randInt, randIntRange } from '../utils/numberUtils'
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
    this.addVar('shadeSpacing', { name: 'gutter', initialValue: 1, min: 0.5, max: 2, step: 0.1 })

    this.addVar('edgeLength', { name: 'edgeLength', initialValue: 10.8, min: 1, max: 100, step: 0.1 }) // prettier-ignore
    this.addVar('angle', {
      name: 'angle',
      initialValue: 30 * (Math.PI / 180),
      min: 7.5 * (Math.PI / 180),
      max: Math.PI,
      step: 7.5 * (Math.PI / 180),
    })
  }

  get hSize() {
    return Math.cos(this.vars.angle) * this.vars.edgeLength * 2
  }

  get vSize() {
    return Math.sin(this.vars.angle) * this.vars.edgeLength
  }

  getPtForCoords(x: number, y: number) {
    const { gutter } = this.vars
    return new Point(
      gutter + x * this.hSize + (y % 2 === 0 ? 0 : this.hSize / 2),
      gutter + y * this.vSize
    )
  }

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)
    // isometric grid, go

    const { gutter, edgeLength, angle } = this.vars

    const maxX = Math.floor((this.cw - gutter * 2) / this.hSize)
    const maxY = Math.floor((this.ch - gutter * 2) / this.vSize)

    for (let y = 0; y < maxY; y++) {
      for (let x = 0; x < maxX; x++) {
        const pt = this.getPtForCoords(x, y)
        this.ctx.beginPath()
        if (y % 4 !== 2 && y !== 0) {
          this.ctx.moveTo(...pt.toArray())
          this.ctx.lineToRelativeAngle(-angle, edgeLength)
          if (y % 4 === 1 && x === maxX - 1) {
            this.ctx.lineToRelative(0, this.vSize * 2)
          }
        }
        if (y % 4 !== 1 && y !== maxY - 1) {
          this.ctx.moveTo(...pt.toArray())
          this.ctx.lineToRelativeAngle(angle, edgeLength)
        }
        if (y % 4 !== 2 && y % 4 !== 3) {
          this.ctx.moveTo(...pt.toArray())
          this.ctx.lineToRelative(0, this.vSize * 2)
        }

        this.ctx.stroke()
        // debugText(this.ctx, `${x},${y}`, pt, { size: 2 })
      }
    }

    this.shadeCell(1, 3, 0.5)
    this.shadeCell(2, 0, 1, Math.PI / 2 - angle)

    // TODO: this properly
    for (let i = 0; i < 20; i++) {
      this.shadeCell(
        randIntRange(maxX),
        randIntRange(Math.floor(maxY / 4)) * 4,
        randFloatRange(0.5, 1)
      )
    }
  }

  shadeCell(x: number, y: number, weight = 1, angleOffset = 0) {
    const { edgeLength, angle, shadeSpacing: _shadeSpacing } = this.vars
    const shadeSpacing = _shadeSpacing * weight

    const innerEdgeLength = edgeLength - shadeSpacing * 2
    const lines = Math.floor(innerEdgeLength / shadeSpacing)
    const spacing = innerEdgeLength / lines

    const pt = this.getPtForCoords(x, y).moveAlongAngle(angleOffset + angle, spacing)

    for (let i = 0; i < lines + 1; i++) {
      this.ctx.beginPath()
      this.ctx.moveTo(
        ...pt
          .clone()
          .moveAlongAngle(angleOffset + angle, spacing * i)
          .toArray()
      )
      this.ctx.lineToRelativeAngle(angleOffset + -angle, edgeLength)
      this.ctx.stroke()
    }
  }

  draw(increment: number): void {
    //
  }
}
