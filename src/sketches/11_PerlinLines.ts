import { deg360 } from '../constants/angles'
import { Sketch } from '../Sketch'
import { perlin2, seedNoise } from '../utils/noise'
import { initPen, penUp } from '../utils/penUtils'
import { seedRandom } from '../utils/random'
import Range from './tools/Range'

export default class PerlinLines extends Sketch {
  // static generateGCode = false
  static enableCutouts = false

  init() {
    this.vs.speedUp = new Range({
      initialValue: 1,
      min: 1,
      max: 100,
      step: 1,
      disableRandomize: true,
    })
    this.vs.seed = new Range({
      initialValue: 9275,
      min: 1000,
      max: 5000,
      step: 1,
    })
    this.vs.cols = new Range({ initialValue: 150, min: 1, max: 300, step: 1 })
    this.vs.rows = new Range({ initialValue: 120, min: 1, max: 300, step: 1 })
    this.vs.size = new Range({ initialValue: 0.5, min: 0.1, max: 8, step: 0.1 })
    this.vs.perlinDivX = new Range({
      initialValue: 75,
      min: 1,
      max: 100,
      step: 1,
    })
    this.vs.perlinDivY = new Range({
      initialValue: 75,
      min: 1,
      max: 100,
      step: 1,
    })
    this.vs.perlinOffsetX = new Range({
      initialValue: 0,
      min: -100,
      max: 100,
      step: 1,
    })
    this.vs.perlinOffsetY = new Range({
      initialValue: 0,
      min: -100,
      max: 100,
      step: 1,
    })
    this.vs.drawOffsetStart = new Range({
      initialValue: 1,
      min: -5,
      max: 5,
      step: 0.1,
    })
    this.vs.drawOffsetEnd = new Range({
      initialValue: -4.5,
      min: -5,
      max: 5,
      step: 0.1,
    })
    this.vs.outerGap = new Range({
      initialValue: 18,
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
  private cutOutCircle = false

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
    this.cutOutCircle = false
  }

  draw(increment: number): void {
    if (this.drawCount >= this.maxDrawCount) {
      if (!this.cutOutCircle) {
        // this.ctx.clearCircle(this.cx, this.cy, 20)
        this.cutOutCircle = true
      }

      penUp(this)
      return
    }

    const cols = this.vs.cols.value
    const rows = this.vs.rows.value
    const outerGap = this.vs.outerGap.value
    const size = this.vs.size.value
    const perlinDivX = this.vs.perlinDivX.value
    const perlinDivY = this.vs.perlinDivY.value
    const perlinOffsetX = this.vs.perlinOffsetX.value
    const perlinOffsetY = this.vs.perlinOffsetY.value
    const drawOffsetStart = this.vs.drawOffsetStart.value
    const drawOffsetEnd = this.vs.drawOffsetEnd.value

    const spaceX = this.effectiveWidth / cols
    const spaceY = this.effectiveHeight / rows

    const adjustedSize = size / (1 + (this.vs.size.max - (cols + rows) / 2) / 500)

    for (let i = 0; i < this.vs.speedUp.value; i++) {
      const realCount = this.drawCount + i
      if (realCount >= this.maxDrawCount) break

      const x = realCount % cols
      const y = Math.floor(realCount / cols)

      const xPos = outerGap + x * spaceX
      const yPos = outerGap + y * spaceY

      const theta =
        perlin2((x + perlinOffsetX) / perlinDivX, (y + perlinOffsetY) / perlinDivY) * deg360
      const pt1 = {
        x: xPos + Math.cos(theta) * (adjustedSize + drawOffsetStart),
        y: yPos + Math.sin(theta) * (adjustedSize + drawOffsetStart),
      }
      const pt2 = {
        x: xPos + Math.cos(theta + Math.PI) * (adjustedSize + drawOffsetEnd),
        y: yPos + Math.sin(theta + Math.PI) * (adjustedSize + drawOffsetEnd),
      }

      this.ctx.beginPath()

      // alternate so the pencil has less space to move
      if (realCount % 2 === 0) {
        this.ctx.moveTo(pt1.x, pt1.y)
        this.ctx.lineTo(pt2.x, pt2.y)
      } else {
        this.ctx.moveTo(pt2.x, pt2.y)
        this.ctx.lineTo(pt1.x, pt1.y)
      }

      this.ctx.stroke()
      this.ctx.endPath()
    }
    this.drawCount += this.vs.speedUp.value
  }
}
