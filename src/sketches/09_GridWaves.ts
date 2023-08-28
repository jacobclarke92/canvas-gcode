import Point from '../Point'
import { Sketch } from '../Sketch'
import Range from './tools/Range'

interface Circle {
  position: Point
  radius: number
}

export default class GridWaves extends Sketch {
  // static generateGCode = false
  static enableCutouts = false

  effectiveWidth: number
  effectiveHeight: number

  init() {
    // this.vs.seed = new Range({ initialValue: 1000, min: 1000, max: 5000, step: 1 })
    this.vs.cols = new Range({ initialValue: 3, min: 1, max: 10, step: 1, disableRandomize: true })
    this.vs.rows = new Range({ initialValue: 4, min: 1, max: 10, step: 1, disableRandomize: true })
    this.vs.gap = new Range({ initialValue: 2, min: 0, max: 25, step: 1, disableRandomize: true })
    this.vs.outerGap = new Range({ initialValue: 5, min: 0, max: 25, step: 1, disableRandomize: true })
  }

  initDraw(): void {
    // seedRandom(this.vs.seed.value)
    const cols = this.vs.cols.value
    const rows = this.vs.rows.value
    const gap = this.vs.gap.value
    const outerGap = this.vs.outerGap.value
    this.effectiveWidth = this.cw - outerGap * 2
    this.effectiveHeight = this.ch - outerGap * 2
    const boxWidth = (this.effectiveWidth - gap * (cols - 1)) / cols
    let x = outerGap
    let y = outerGap
    for (let i = 0; i < rows; i++) {
      x = outerGap
      for (let j = 0; j < cols; j++) {
        this.ctx.beginPath()
        this.ctx.rect(x, y, boxWidth, boxWidth)
        this.ctx.stroke()
        this.ctx.closePath()
        x += boxWidth + gap
      }
      y += boxWidth + gap
    }
  }

  draw(increment: number): void {}
}
