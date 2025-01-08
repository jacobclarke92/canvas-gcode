import * as clipperLib from 'js-angusj-clipper/web'

import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
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

    this.addVar('hSize', { name: 'hSize', initialValue: 10, min: 1, max: 100, step: 0.1 })
    this.addVar('angle', {
      name: 'angle',
      initialValue: Math.PI / 24,
      min: 0,
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

    const { hSize, angle } = this.vars

    const vSize = Math.sin(angle) * hSize * 2

    for (let y = 0; y < Math.floor(this.ch / vSize); y++) {
      for (let x = 0; x < Math.floor(this.cw / hSize); x++) {
        const pt = new Point(x * hSize + (y % 2 === 0 ? 0 : hSize / 2), y * vSize)
        // debugDot(this.ctx, pt)
        this.ctx.beginPath()
        if (random() > 0.5) {
          this.ctx.moveTo(...pt.toArray())
          this.ctx.lineTo(pt.x + hSize / 2, pt.y + vSize)
        }
        if (random() > 0.5) {
          this.ctx.moveTo(...pt.toArray())
          this.ctx.lineTo(pt.x + hSize / 2, pt.y - vSize)
        }
        if (random() > 0.5) {
          this.ctx.moveTo(...pt.toArray())
          this.ctx.lineTo(pt.x, pt.y + vSize * 2)
        }
        this.ctx.stroke()
      }
    }
  }

  draw(increment: number): void {
    //
  }
}
