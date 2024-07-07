import { Sketch } from '../Sketch'
import { perlin2, seedNoise } from '../utils/noise'
import { initPen, penUp } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import Range from './tools/Range'

export default class PerlinGrid extends Sketch {
  // static generateGCode = false
  static enableCutouts = false

  init() {
    this.vs.speedUp = new Range({
      initialValue: 10,
      min: 1,
      max: 100,
      step: 1,
      disableRandomize: true,
    })
    this.vs.seed = new Range({
      initialValue: 1000,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.vs.cols = new Range({
      initialValue: 90,
      min: 1,
      max: 200,
      step: 1,
      disableRandomize: true,
    })
    this.vs.rows = new Range({
      initialValue: 90,
      min: 1,
      max: 200,
      step: 1,
      disableRandomize: true,
    })
    this.vs.shape = new Range({
      initialValue: 1,
      min: 0,
      max: 1,
      step: 1,
      disableRandomize: true,
    })
    this.vs.size = new Range({ initialValue: 18, min: 0.1, max: 64, step: 0.1 })
    this.vs.perlinDiv = new Range({
      initialValue: 25,
      min: 1,
      max: 100,
      step: 1,
      disableRandomize: true,
    })
    this.vs.offsetX = new Range({
      initialValue: 0,
      min: -100,
      max: 100,
      step: 1,
    })
    this.vs.offsetY = new Range({
      initialValue: 0,
      min: -100,
      max: 100,
      step: 1,
    })
    this.vs.outerGap = new Range({
      initialValue: 12,
      min: 0,
      max: 25,
      step: 1,
      disableRandomize: true,
    })
  }

  private drawCount = 0
  private maxDrawCount = 0
  private effectiveWidth: number
  private effectiveHeight: number

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)
    initPen(this)
    const cols = this.vs.cols.value
    const rows = this.vs.rows.value
    const outerGap = this.vs.outerGap.value
    this.effectiveWidth = this.cw - outerGap * 2
    this.effectiveHeight = this.ch - outerGap * 2
    this.drawCount = 0
    this.maxDrawCount = rows * cols
  }

  draw(increment: number): void {
    if (this.drawCount >= this.maxDrawCount) {
      penUp(this)
      return
    }

    let speedUp = this.vs.speedUp.value
    const cols = this.vs.cols.value
    const rows = this.vs.rows.value
    const outerGap = this.vs.outerGap.value
    const size = this.vs.size.value
    const shape = this.vs.shape.value
    const perlinDiv = this.vs.perlinDiv.value
    const offsetX = this.vs.offsetX.value
    const offsetY = this.vs.offsetY.value

    const colWidth = this.effectiveWidth / cols
    const rowHeight = this.effectiveHeight / rows

    if (shape === 0) speedUp = Math.max(1, Math.floor(speedUp / 4))

    for (let i = 0; i < this.vs.speedUp.value; i++) {
      const realCount = this.drawCount + i
      if (realCount >= this.maxDrawCount) break

      const x = realCount % cols
      const y = Math.floor(realCount / cols)

      const xPos = outerGap + x * colWidth
      const yPos = outerGap + y * rowHeight
      const radius = Math.abs(perlin2((x + offsetX) / perlinDiv, (y + offsetY) / perlinDiv)) * size

      this.ctx.beginPath()
      if (shape === 0) this.ctx.circle(xPos, yPos, radius)
      else if (shape === 1) this.ctx.rect(xPos - radius / 2, yPos - radius / 2, radius, radius)
      this.ctx.stroke()
      this.ctx.closePath()
    }
    this.drawCount += this.vs.speedUp.value
  }
}
