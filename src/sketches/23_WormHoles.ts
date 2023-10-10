import { Sketch } from '../Sketch'
import { shuffle } from '../utils/arrayUtils'
import { randIntRange } from '../utils/numberUtils'
import { random, seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

type Pos = [number, number]

export default class WormHoles extends Sketch {
  // static generateGCode = false

  init() {
    this.addVar('speedUp', { initialValue: 1, min: 1, max: 100, step: 1, disableRandomize: true })
    this.addVar('randSeed', { initialValue: 3190, min: 1000, max: 10000, step: 1, disableRandomize: true })
    this.addVar('stopAfter', { initialValue: 128, min: 5, max: 2000, step: 1, disableRandomize: true })
    this.vs.drawGrid = new BooleanRange({ disableRandomize: true, initialValue: true })

    this.addVar('divisions', { initialValue: 50, min: 1, max: 200, step: 1 })
    this.addVar('thickness', { initialValue: 1, min: 0.01, max: 1, step: 0.01 })
    this.addVar('gap', { initialValue: 2, min: 1, max: 20, step: 0.1 })
    this.addVar('minWidth', { initialValue: 1, min: 1, max: 20, step: 1 })
    this.addVar('maxWidth', { initialValue: 4, min: 1, max: 20, step: 1 })
    this.addVar('minHeight', { initialValue: 1, min: 1, max: 20, step: 1 })
    this.addVar('maxHeight', { initialValue: 4, min: 1, max: 20, step: 1 })
  }

  stopDrawing = false
  increment = 0

  initDraw(): void {
    seedRandom(this.vars.randSeed)

    this.stopDrawing = false
    this.increment = 0

    const gap = this.vs.gap.value

    this.drawWorm({
      xSeg: 20,
      yPos: this.ch / 2,
      width: 10,
      height: 10,
    })

    this.drawWorm({
      xSeg: 20 + 10 + gap,
      yPos: this.ch / 2,
      width: 2,
      height: 8,
    })

    this.drawWorm({
      xSeg: 20 + 10 + gap + 2 + gap,
      yPos: this.ch / 2,
      width: 5,
      height: 1,
    })

    this.drawWorm({
      xSeg: 20 + 10 + gap + 2 + gap + 5 + gap,
      yPos: this.ch / 2,
      width: 3,
      height: 9,
    })
  }

  drawWorm(options: { xSeg: number; yPos: number; width: number; height: number }) {
    const { xSeg, yPos, width, height } = options

    const thickness = this.vs.thickness.value
    const segment = this.cw / this.vs.divisions.value
    const outerRadius = width / 2 + thickness
    const innerRadius = width / 2 - thickness / 2

    this.ctx.beginPath()
    this.ctx.moveTo((xSeg - thickness / 2) * segment, yPos)
    this.ctx.bezierCurveTo(
      (xSeg - thickness / 2) * segment,
      yPos + (thickness / 2) * segment,
      (xSeg + thickness / 2) * segment,
      yPos + (thickness / 2) * segment,
      (xSeg + thickness / 2) * segment,
      yPos
    )
    this.ctx.lineTo((xSeg + thickness / 2) * segment, yPos - height * segment)
    this.ctx.bezierCurveTo(
      (xSeg + thickness / 2) * segment,
      yPos - (height + innerRadius) * segment,
      (xSeg + width - thickness / 2) * segment,
      yPos - (height + innerRadius) * segment,
      (xSeg + width - thickness / 2) * segment,
      yPos - height * segment
    )
    this.ctx.lineTo((xSeg + width - thickness / 2) * segment, yPos)
    this.ctx.bezierCurveTo(
      (xSeg + width - thickness / 2) * segment,
      yPos + (thickness / 2) * segment,
      (xSeg + width + thickness / 2) * segment,
      yPos + (thickness / 2) * segment,
      (xSeg + width + thickness / 2) * segment,
      yPos
    )
    this.ctx.lineTo((xSeg + width + thickness / 2) * segment, yPos - height * segment)
    this.ctx.bezierCurveTo(
      (xSeg + width + thickness / 2) * segment,
      yPos - (height + outerRadius) * segment,
      (xSeg - thickness / 2) * segment,
      yPos - (height + outerRadius) * segment,
      (xSeg - thickness / 2) * segment,
      yPos - height * segment
    )
    this.ctx.lineTo((xSeg - thickness / 2) * segment, yPos)

    this.ctx.stroke()
    this.ctx.closePath()
  }

  draw(increment: number): void {
    if (this.stopDrawing) return
    this.increment++
    if (this.increment > this.vars.stopAfter) return
  }
}
