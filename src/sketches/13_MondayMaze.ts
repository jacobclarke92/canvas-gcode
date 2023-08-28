import { Sketch } from '../Sketch'
import { normalizeRadian, randInt, segmentValue } from '../utils/numberUtils'
import { seedRandom } from '../utils/random'
import Range from './tools/Range'

export default class MondayMaze extends Sketch {
  // static generateGCode = false
  static enableCutouts = false

  init() {
    this.vs.speedUp = new Range({ initialValue: 1, min: 1, max: 100, step: 1, disableRandomize: true })
    this.vs.seed = new Range({ initialValue: 2222, min: 1000, max: 5000, step: 1 })
    this.vs.gridSize = new Range({ initialValue: 2, min: 1, max: 8, step: 0.25 })
    this.vs.radialDivs = new Range({ initialValue: 2, min: 1, max: 4, step: 1 })
    this.vs.offsetAng = new Range({ initialValue: 0, min: 0, max: 360, step: 15 })
  }

  private rows: number
  private cols: number
  private i: number
  // private segCache: number[]

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    this.i = 0
    this.rows = Math.ceil(this.cw / this.vs.gridSize.value) + 1
    this.cols = Math.ceil(this.ch / this.vs.gridSize.value) + 1
    return
    if (this.ctx.ctx) {
      this.ctx.ctx.strokeStyle = '#ddd'
      for (let r = 0; r < this.rows; r++) {
        this.ctx.ctx.moveTo(0, r * this.vs.gridSize.value)
        this.ctx.ctx.lineTo(this.cw, r * this.vs.gridSize.value)
        this.ctx.ctx.stroke()
      }
      for (let c = 0; c < this.cols; c++) {
        this.ctx.ctx.moveTo(c * this.vs.gridSize.value, 0)
        this.ctx.ctx.lineTo(c * this.vs.gridSize.value, this.ch)
        this.ctx.ctx.stroke()
      }
    }
  }

  draw(increment: number): void {
    if (this.i >= this.rows * this.cols) return
    for (let n = 0; n < this.vs.speedUp.value; n++) {
      if (this.i >= this.rows * this.cols) break

      const xI = this.i % this.rows
      const yI = Math.floor(this.i / this.rows)
      const x = xI * this.vs.gridSize.value
      const y = yI * this.vs.gridSize.value

      const offsetAngle = segmentValue(this.vs.offsetAng.value, this.vs.offsetAng.max, Math.PI * 2)
      const segIndex = randInt(this.vs.radialDivs.value)
      let angle = (Math.PI / this.vs.radialDivs.value) * segIndex
      angle = normalizeRadian(angle)

      if (angle > Math.PI / 2) angle -= Math.PI
      if (angle < Math.PI / 2) angle += Math.PI

      angle += offsetAngle

      this.ctx.beginPath()
      // this.ctx.rect(x - 0.2, y - 0.2, 0.4, 0.4)
      // this.ctx.fill()

      this.ctx.moveTo(x, y)

      const len = Math.min(
        Math.abs(this.vs.gridSize.value / Math.cos(angle)),
        Math.abs(this.vs.gridSize.value / Math.sin(angle))
      )

      this.ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len)
      this.ctx.stroke()
      this.ctx.closePath()

      this.i++
    }
  }
}
