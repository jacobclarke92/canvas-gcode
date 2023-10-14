import { Sketch } from '../Sketch'
import { shuffle } from '../utils/arrayUtils'
import { randFloat, randFloatRange, randIntRange } from '../utils/numberUtils'
import { random, seedRandom } from '../utils/random'
import { BooleanRange } from './tools/Range'

type Pos = [number, number]

export default class WormHoles extends Sketch {
  // static generateGCode = false

  init() {
    this.addVar('speedUp', { initialValue: 1, min: 1, max: 100, step: 1, disableRandomize: true })
    this.addVar('randSeed', { initialValue: 5321, min: 1000, max: 10000, step: 1, disableRandomize: true })
    this.addVar('stopAfter', { initialValue: 128, min: 5, max: 2000, step: 1, disableRandomize: true })
    this.vs.cutout = new BooleanRange({ disableRandomize: true, initialValue: false })

    this.addVar('xDivs', { initialValue: 60, min: 1, max: 200, step: 1 })
    this.addVar('yDivs', { initialValue: 25, min: 1, max: 200, step: 1 })
    this.addVar('startY', { initialValue: 0.4, min: 0, max: 1, step: 0.01 })
    this.addVar('endY', { initialValue: 0.9, min: 0, max: 1, step: 0.01 })
    this.addVar('startX', { initialValue: 0.22, min: 0, max: 1, step: 0.01 })
    this.addVar('endX', { initialValue: 0.45, min: 0, max: 1, step: 0.01 })
    this.addVar('perspective', { initialValue: 1.2, min: 0.9, max: 1.5, step: 0.01 })
    this.addVar('thickness', { initialValue: 3.5, min: 0.01, max: 5, step: 0.01 })
    this.addVar('randOffsetX', { initialValue: 8, min: 0, max: 10, step: 0.01 })
    this.addVar('gap', { initialValue: 5, min: 1, max: 15, step: 0.1 })
    this.addVar('randGap', { initialValue: 6, min: 0, max: 10, step: 0.01 })
    this.addVar('minWidth', { initialValue: 4, min: 1, max: 20, step: 1 })
    this.addVar('maxWidth', { initialValue: 10, min: 1, max: 20, step: 1 })
    this.addVar('minHeight', { initialValue: 1, min: 1, max: 20, step: 1 })
    this.addVar('maxHeight', { initialValue: 10, min: 1, max: 20, step: 1 })
  }

  stopDrawing = false
  increment = 0

  initDraw(): void {
    seedRandom(this.vars.randSeed)

    this.stopDrawing = false
    this.increment = 0

    const { gap, xDivs, yDivs, startY, endY, startX, endX } = this.vars
    const segW = this.cw / xDivs
    const segH = this.ch / yDivs

    let xSeg = xDivs * startX
    let ySeg = yDivs * startY
    let scale = 0.5

    while (ySeg < this.vars.yDivs * endY) {
      const yPos = ySeg * segH
      const offsetX = randFloatRange(this.vars.randOffsetX, -this.vars.randOffsetX)
      while ((xSeg + offsetX) * scale < this.vars.xDivs * endX) {
        const width = randIntRange(this.vars.minWidth, this.vars.maxWidth)
        const segGap = gap + randFloatRange(this.vars.randGap, 0)
        // width = Math.min(width, this.vars.xDivs - (xSeg + gap))
        if (xSeg * scale + width > this.vars.xDivs + segGap) break

        const height = randIntRange(this.vars.minHeight, this.vars.maxHeight)

        this.drawWorm({
          segW: segW * scale,
          segH: segW * scale,
          xSeg: xSeg - offsetX * scale,
          yPos,
          width,
          height,
          scale,
        })

        xSeg += width + segGap
      }
      scale *= this.vars.perspective
      xSeg = xDivs * startX
      ySeg++
    }
  }

  drawWorm(options: {
    segW: number
    segH: number
    xSeg: number
    yPos: number
    width: number
    height: number
    scale: number
  }) {
    const { segW, segH, xSeg, yPos, scale, width, height } = options

    const thickness = this.vars.thickness
    const outerRadius = width / 2 + thickness
    const innerRadius = width / 2 - thickness / 2

    this.ctx.beginPath()
    this.ctx.moveTo((xSeg - thickness / 2) * segW, yPos)
    this.ctx.bezierCurveTo(
      (xSeg - thickness / 2) * segW,
      yPos + (thickness / 2) * segH,
      (xSeg + thickness / 2) * segW,
      yPos + (thickness / 2) * segH,
      (xSeg + thickness / 2) * segW,
      yPos
    )
    this.ctx.lineTo((xSeg + thickness / 2) * segW, yPos - height * segH)
    this.ctx.bezierCurveTo(
      (xSeg + thickness / 2) * segW,
      yPos - (height + innerRadius) * segH,
      (xSeg + width - thickness / 2) * segW,
      yPos - (height + innerRadius) * segH,
      (xSeg + width - thickness / 2) * segW,
      yPos - height * segH
    )
    this.ctx.lineTo((xSeg + width - thickness / 2) * segW, yPos)
    this.ctx.bezierCurveTo(
      (xSeg + width - thickness / 2) * segW,
      yPos + (thickness / 2) * segH,
      (xSeg + width + thickness / 2) * segW,
      yPos + (thickness / 2) * segH,
      (xSeg + width + thickness / 2) * segW,
      yPos
    )
    this.ctx.lineTo((xSeg + width + thickness / 2) * segW, yPos - height * segH)
    this.ctx.bezierCurveTo(
      (xSeg + width + thickness / 2) * segW,
      yPos - (height + outerRadius) * segH,
      (xSeg - thickness / 2) * segW,
      yPos - (height + outerRadius) * segH,
      (xSeg - thickness / 2) * segW,
      yPos - height * segH
    )
    this.ctx.lineTo((xSeg - thickness / 2) * segW, yPos)

    this.ctx.stroke({ cutout: !!this.vs.cutout.value })
    this.ctx.closePath()
  }

  draw(increment: number): void {
    if (this.stopDrawing) return
    this.increment++
    if (this.increment > this.vars.stopAfter) return
  }
}
