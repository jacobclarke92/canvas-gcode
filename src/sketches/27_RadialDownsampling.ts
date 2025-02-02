import { deg360 } from '../constants/angles'
import Point from '../Point'
import { Sketch } from '../Sketch'
import { debugDot } from '../utils/debugUtils'
import { perlin2, seedNoise } from '../utils/noise'
import { seedRandom } from '../utils/random'
import Range, { BooleanRange } from './tools/Range'

export default class RadialDownsampling extends Sketch {
  // static generateGCode = false
  static enableCutouts = false

  init() {
    this.vs.useCircle = new BooleanRange({
      disableRandomize: true,
      initialValue: false,
    })
    this.vs.speedUp = new Range({ name: 'speedUp', initialValue: 10, min: 1, max: 100, step: 1, disableRandomize: true }, this) // prettier-ignore
    this.vs.seed = new Range({ name: 'seed', initialValue: 1000, min: 1000, max: 5000, step: 1 }, this) // prettier-ignore
    this.vs.rings = new Range({ name: 'rings', initialValue: 50, min: 3, max: 120, step: 1 }, this) // prettier-ignore
    this.vs.complexity = new Range({ name: 'complexity', initialValue: 36, min: 4, max: 360, step: 1 }, this) // prettier-ignore
    this.vs.complexityReduction = new Range({ name: 'complexityReduction', initialValue: 5.8, min: 0, max: 12, step: 0.05, disableRandomize: true }, this) // prettier-ignore
    this.vs.drawSize = new Range({ name: 'drawSize', initialValue: 7, min: 0.05, max: 10, step: 0.01, disableRandomize: true }, this) // prettier-ignore
    this.vs.outerGap = new Range({ initialValue: 12, min: 0, max: 25, step: 1, disableRandomize: true }, this) // prettier-ignore

    // BACK IN A BIT
    // setInterval(() => {
    //   this.reset()
    //   Object.values(this.vs).forEach((v) => v.randomize())
    //   this.initDraw()
    // }, 5000)
  }

  private drawCount = 0
  private effectiveWidth: number
  private effectiveHeight: number

  initDraw(): void {
    seedRandom(this.vs.seed.value)
    seedNoise(this.vs.seed.value)

    const outerGap = this.vs.outerGap.value
    this.effectiveWidth = this.cw - outerGap * 2
    this.effectiveHeight = this.ch - outerGap * 2
    this.drawCount = 0
  }

  draw(increment: number): void {
    const { rings, complexity, complexityReduction, drawSize } = this.vars

    if (this.drawCount >= rings) return

    const ringSpacing = this.effectiveHeight / 2 / rings

    // for (let i = 0; i < speedUp; i++) {
    const radius = (this.drawCount + 1) * ringSpacing

    const ringPts = Math.max(
      4,
      complexity - Math.ceil(complexity - this.drawCount * complexityReduction)
    )

    for (let t = 0; t < ringPts; t++) {
      const angle = (t / ringPts) * deg360
      const pt = new Point(this.cx + Math.cos(angle) * radius, this.cy + Math.sin(angle) * radius)
      this.ctx.beginPath()
      if (this.vs.useCircle.value) {
        this.ctx.strokeCircle(pt.x, pt.y, drawSize)
      } else {
        this.ctx.moveTo(
          pt.x + (Math.cos(angle) * drawSize) / 2,
          pt.y + (Math.sin(angle) * drawSize) / 2
        )
        this.ctx.lineTo(
          pt.x + (Math.cos(angle) * -drawSize) / 2,
          pt.y + (Math.sin(angle) * -drawSize) / 2
        )
        this.ctx.stroke()
      }
      this.ctx.endPath()
    }
    this.drawCount++

    // }
  }
}
