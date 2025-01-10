import Point from '../Point'
import { Sketch } from '../Sketch'
import { seedNoise } from '../utils/noise'
import { randFloatRange, randIntRange } from '../utils/numberUtils'
import { initPen, plotBounds } from '../utils/penUtils'
import { random, seedRandom } from '../utils/random'

export default class IsometricGrid extends Sketch {
  // static generateGCode = false
  static enableCutouts = false
  static disableOverclock = true

  init() {
    this.addVar('speedUp',{ name: 'speedUp', initialValue: 10, min: 1, max: 100, step: 1, disableRandomize: true }) // prettier-ignore
    this.addVar('seed', { name: 'seed', initialValue: 1000, min: 1000, max: 5000, step: 1 })
    this.addVar('gutter', { name: 'gutter', initialValue: 10, min: 1, max: 100, step: 1 })
    this.addVar('shadeSpacing', { name: 'gutter', initialValue: 1.2, min: 0.5, max: 2, step: 0.1 })
    this.addVar('shadeAttempts', { name: 'gutter', initialValue: 64, min: 0, max: 255, step: 1 })

    this.addVar('edgeLength', { name: 'edgeLength', initialValue: 10.8, min: 1, max: 100, step: 0.1 }) // prettier-ignore
    this.addVar('angle', {
      name: 'angle',
      initialValue: 30 * (Math.PI / 180),
      min: 7.5 * (Math.PI / 180),
      max: Math.PI,
      step: 7.5 * (Math.PI / 180),
    })
  }

  get hSize() { return Math.cos(this.vars.angle) * this.vars.edgeLength * 2 } // prettier-ignore
  get vSize() { return Math.sin(this.vars.angle) * this.vars.edgeLength } // prettier-ignore
  get xCols() { return Math.floor((this.cw - this.vars.gutter * 2) / this.hSize) } // prettier-ignore
  get yCols() { return Math.floor((this.ch - this.vars.gutter * 2) / this.vSize) } // prettier-ignore
  get offsetX() { return ((this.cw - this.vars.gutter * 2) % this.hSize) / 2 } // prettier-ignore
  get offsetY() { return ((this.ch - this.vars.gutter * 2) % this.vSize) / 2 } // prettier-ignore

  shadedCells: string[] = []

  getPtForCoords(x: number, y: number) {
    const { gutter } = this.vars
    return new Point(
      gutter + this.offsetX + x * this.hSize + (y % 2 === 0 ? 0 : this.hSize / 2),
      gutter + this.offsetY + y * this.vSize
    )
  }

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)
    initPen(this)
    plotBounds(this)
    // isometric grid, go

    this.shadedCells = []

    const { shadeAttempts, edgeLength, angle } = this.vars

    for (let y = 0; y < this.yCols; y++) {
      for (let x = 0; x < this.xCols; x++) {
        const pt = this.getPtForCoords(x, y)
        this.ctx.beginPath()
        if (y % 4 !== 2 && y !== 0) {
          this.ctx.moveTo(...pt.toArray())
          this.ctx.lineToRelativeAngle(-angle, edgeLength)
          if (y % 4 === 1 && x === this.xCols - 1) {
            this.ctx.lineToRelative(0, this.vSize * 2)
          }
        }
        if (y % 4 !== 1 && y !== this.yCols - 1) {
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

    // this.shadeCell(1, 3, 0.5)
    // this.shadeCell(2, 0, 1, Math.PI / 2 - angle)
    // this.shadeCell(2, 0, 1, Math.PI / 2 + angle)

    for (let i = 0; i < shadeAttempts; i++) {
      let x = randIntRange(this.xCols - 1)
      let y = 4 + randIntRange(Math.floor((this.yCols - 5) / 4)) * 4
      if (random() > 0.5) {
        x = (x + 1) % (this.xCols - 1)
        y -= 1
      }
      const key = `${x},${y}`
      if (this.shadedCells.includes(key)) continue
      else this.shadedCells.push(key)
      this.shadeCell(x, y, randFloatRange(0.5, 1))
    }

    for (let i = 0; i < shadeAttempts; i++) {
      const x = randIntRange(this.xCols - 1)
      const y = randIntRange(Math.floor((this.yCols - 1) / 4)) * 4
      const key = `${x},${y}`
      if (this.shadedCells.includes(key)) continue
      else this.shadedCells.push(key)
      this.shadeCell(x, y, randFloatRange(0.5, 1), Math.PI / 2 - angle)
    }

    for (let i = 0; i < shadeAttempts; i++) {
      const x = 1 + randIntRange(this.xCols - 2)
      const y = randIntRange(Math.floor((this.yCols - 1) / 4)) * 4
      const key = `${x},${y}`
      if (this.shadedCells.includes(key)) continue
      else this.shadedCells.push(key)
      this.shadeCell(x, y, randFloatRange(0.5, 1), Math.PI / 2 + angle)
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
